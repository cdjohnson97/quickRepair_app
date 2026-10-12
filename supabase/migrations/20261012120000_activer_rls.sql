-- =====================================================================================
-- FiXeo — Activation du Row Level Security (RLS) sur le schéma public
-- =====================================================================================
-- Contexte : le front web et l'appli mobile accèdent directement à Supabase avec la clé
-- publique (anon). Sans RLS, n'importe qui possédant cette clé pouvait lire et modifier
-- toutes les tables sans être connecté (constat du 11/10/2026, docs/inventaire-cda.md §5.1).
--
-- Principes :
--   * anon (non connecté) : aucun accès aux tables. Les pages publiques (accueil, suivi
--     client) passent par l'API NestJS.
--   * authenticated : un compte connecté n'a des droits que s'il est rattaché à un employé
--     (employes.id_auth = auth.uid()). Les inscriptions Supabase étant ouvertes, un simple
--     compte créé par un inconnu ne voit rien.
--   * Droits selon le rôle de l'employé (Administrateur, Responsable, Technicien) et sa boutique.
--   * L'API NestJS se connecte avec le rôle postgres (BYPASSRLS) : elle n'est pas concernée.
--   * Les fonctions SECURITY DEFINER sont dans le schéma `private`, non exposé par l'API REST.
--
-- Annulation : supabase/rollback/20261012120000_activer_rls.down.sql
-- =====================================================================================

begin;

-- -------------------------------------------------------------------------------------
-- 1. Corrections de données préalables
-- -------------------------------------------------------------------------------------

-- 1a. Rattache chaque employé à son compte Supabase Auth par e-mail (8 employés n'avaient pas
--     d'id_auth et 1 pointait vers un compte supprimé). Les règles RLS identifient l'employé
--     par id_auth, jamais par e-mail : un inconnu ne peut pas s'inscrire avec l'e-mail d'un
--     employé pour hériter de ses droits.
update public.employes e
set id_auth = u.id
from auth.users u
where lower(u.email) = lower(e.email)
  and e.id_auth is distinct from u.id;

-- id_auth pointant vers un compte supprimé : on le vide.
update public.employes e
set id_auth = null
where e.id_auth is not null
  and not exists (select 1 from auth.users u where u.id = e.id_auth);

-- 1b. mot_de_passe_hash contenait des mots de passe EN CLAIR de comptes de test. Les mots de
--     passe sont gérés par Supabase Auth (auth.users) : la colonne ne sert plus.
update public.employes set mot_de_passe_hash = null where mot_de_passe_hash is not null;

-- 1c. Réparations sans boutique (créées depuis le mobile, qui n'envoyait pas id_boutique) :
--     on reprend la boutique du technicien assigné.
update public.reparations r
set id_boutique = e.id_boutique
from public.employes e
where r.id_boutique is null
  and e.id_employe = r.id_technicien
  and e.id_boutique is not null;

-- -------------------------------------------------------------------------------------
-- 2. Fonctions utilitaires (schéma privé, SECURITY DEFINER pour ne pas dépendre du RLS
--    de la table employes elle-même et éviter toute récursion)
-- -------------------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Employé connecté (null si le compte n'est rattaché à aucun employé)
create or replace function private.employe_courant()
returns integer
language sql stable security definer set search_path = ''
as $$
  select e.id_employe from public.employes e where e.id_auth = auth.uid() limit 1
$$;

create or replace function private.role_courant()
returns text
language sql stable security definer set search_path = ''
as $$
  select e.role::text from public.employes e where e.id_auth = auth.uid() limit 1
$$;

create or replace function private.boutique_courante()
returns integer
language sql stable security definer set search_path = ''
as $$
  select e.id_boutique from public.employes e where e.id_auth = auth.uid() limit 1
$$;

-- L'employé cible travaille-t-il dans la même boutique que l'employé connecté ?
create or replace function private.meme_boutique(p_id_employe bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.employes e
    where e.id_employe = p_id_employe
      and e.id_boutique is not null
      and e.id_boutique = private.boutique_courante()
  )
$$;

-- Accès à une réparation : administrateur (toutes), responsable (sa boutique),
-- technicien (celles qui lui sont assignées).
create or replace function private.peut_voir_reparation(p_id_reparation bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.reparations r
    where r.id_reparation = p_id_reparation
      and (
        private.role_courant() = 'Administrateur'
        or (private.role_courant() = 'Responsable' and r.id_boutique = private.boutique_courante())
        or (private.role_courant() = 'Technicien' and r.id_technicien = private.employe_courant())
      )
  )
$$;

-- Clients et appareils visibles par un technicien : ceux de ses réparations.
create or replace function private.client_du_technicien(p_id_client bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.reparations r
    join public.appareils a on a.id_appareil = r.id_appareil
    where a.id_client = p_id_client and r.id_technicien = private.employe_courant()
  )
$$;

create or replace function private.appareil_du_technicien(p_id_appareil bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.reparations r
    where r.id_appareil = p_id_appareil and r.id_technicien = private.employe_courant()
  )
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- -------------------------------------------------------------------------------------
-- 3. Triggers de protection
-- -------------------------------------------------------------------------------------

-- 3a. Un employé peut mettre à jour sa propre ligne (photo, présence, jeton push), mais
--     pas s'attribuer un autre rôle, une autre boutique ou un autre compte. Seul un
--     administrateur le peut. Les accès serveur (API, Edge Function : auth.uid() null)
--     ne sont pas concernés.
create or replace function private.proteger_colonnes_employe()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null
     and private.role_courant() is distinct from 'Administrateur'
     and (new.id_employe, new.role, new.id_boutique, new.email, new.id_auth, new.mot_de_passe_hash)
         is distinct from
         (old.id_employe, old.role, old.id_boutique, old.email, old.id_auth, old.mot_de_passe_hash)
  then
    raise exception 'Modification non autorisée : seul un administrateur peut changer le rôle, la boutique ou le compte d''un employé.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_colonnes_employe on public.employes;
create trigger proteger_colonnes_employe
  before update on public.employes
  for each row execute function private.proteger_colonnes_employe();

-- 3b. Une réparation créée sans boutique (ancienne version du mobile) prend celle du
--     responsable connecté.
create or replace function private.reparation_boutique_par_defaut()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.id_boutique is null and auth.uid() is not null then
    new.id_boutique := private.boutique_courante();
  end if;
  return new;
end;
$$;

drop trigger if exists reparation_boutique_par_defaut on public.reparations;
create trigger reparation_boutique_par_defaut
  before insert on public.reparations
  for each row execute function private.reparation_boutique_par_defaut();

-- 3c. Historisation des statuts : la fonction existante s'exécutait avec les droits de
--     l'appelant. Avec le RLS, l'insertion dans historique_statuts serait refusée : elle
--     passe en SECURITY DEFINER (même logique qu'avant).
create or replace function public.log_changement_statut()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.id_statut_actuel is distinct from new.id_statut_actuel then
    insert into public.historique_statuts (id_reparation, id_statut, date_changement, id_employe, commentaire)
    values (new.id_reparation, new.id_statut_actuel, now(), new.id_technicien,
            'Mise à jour automatique suite au changement de statut.');
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------------------------------
-- 4. Droits des rôles anon / authenticated
-- -------------------------------------------------------------------------------------

-- anon : plus aucun accès direct aux tables (y compris TRUNCATE, qui ignore le RLS).
revoke all on all tables in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;

-- authenticated : TRUNCATE ignore le RLS, TRIGGER et REFERENCES sont inutiles.
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- Messages : seuls « lu » et « reaction » sont modifiables (pas le contenu ni l'expéditeur).
revoke update on public.messages from authenticated;
grant update (lu, reaction) on public.messages to authenticated;

-- -------------------------------------------------------------------------------------
-- 5. Activation du RLS sur toutes les tables du schéma public
-- -------------------------------------------------------------------------------------
alter table public.appareils             enable row level security;
alter table public.boutiques             enable row level security;
alter table public.calendrier_evenements enable row level security;
alter table public.clients               enable row level security;
alter table public.employes              enable row level security;
alter table public.factures              enable row level security;
alter table public.fournisseurs          enable row level security;  -- aucune règle : API uniquement
alter table public.historique_statuts    enable row level security;
alter table public.messages              enable row level security;
alter table public.pieces                enable row level security;  -- aucune règle : API uniquement
alter table public.reparations           enable row level security;
alter table public.statuts               enable row level security;
alter table public.stock_boutique        enable row level security;  -- aucune règle : API uniquement
alter table public.types_reparation      enable row level security;

-- Ancienne règle « tout le monde peut tout faire » sur les factures
drop policy if exists "Tout le monde peut gérer les factures" on public.factures;

-- -------------------------------------------------------------------------------------
-- 6. Règles d'accès (policies). `(select fonction())` : évaluée une fois par requête.
-- -------------------------------------------------------------------------------------

-- employes ---------------------------------------------------------------------------
-- Lecture : tout employé (messagerie, équipes, contacts administrateurs).
create policy employes_select on public.employes for select to authenticated
  using ((select private.role_courant()) is not null);
create policy employes_insert on public.employes for insert to authenticated
  with check ((select private.role_courant()) = 'Administrateur');
-- Modification : administrateur, ou l'employé lui-même (colonnes sensibles protégées par 3a).
create policy employes_update on public.employes for update to authenticated
  using ((select private.role_courant()) = 'Administrateur' or id_employe = (select private.employe_courant()))
  with check ((select private.role_courant()) = 'Administrateur' or id_employe = (select private.employe_courant()));
create policy employes_delete on public.employes for delete to authenticated
  using ((select private.role_courant()) = 'Administrateur');

-- boutiques --------------------------------------------------------------------------
create policy boutiques_select on public.boutiques for select to authenticated
  using ((select private.role_courant()) is not null);
create policy boutiques_insert on public.boutiques for insert to authenticated
  with check ((select private.role_courant()) = 'Administrateur');
create policy boutiques_update on public.boutiques for update to authenticated
  using ((select private.role_courant()) = 'Administrateur')
  with check ((select private.role_courant()) = 'Administrateur');
create policy boutiques_delete on public.boutiques for delete to authenticated
  using ((select private.role_courant()) = 'Administrateur');

-- statuts, types_reparation : référentiels en lecture seule ----------------------------
create policy statuts_select on public.statuts for select to authenticated
  using ((select private.role_courant()) is not null);
create policy types_reparation_select on public.types_reparation for select to authenticated
  using ((select private.role_courant()) is not null);

-- messages : uniquement les conversations de l'employé connecté -------------------------
create policy messages_select on public.messages for select to authenticated
  using (
    id_expediteur = (select private.employe_courant())
    or id_destinataire = (select private.employe_courant())
  );
create policy messages_insert on public.messages for insert to authenticated
  with check (id_expediteur = (select private.employe_courant()));
create policy messages_update on public.messages for update to authenticated
  using (
    id_expediteur = (select private.employe_courant())
    or id_destinataire = (select private.employe_courant())
  );

-- calendrier_evenements -----------------------------------------------------------------
-- Lecture : ses événements et ceux de sa boutique (disponibilités) ; tout pour l'admin.
create policy calendrier_select on public.calendrier_evenements for select to authenticated
  using (
    (select private.role_courant()) = 'Administrateur'
    or id_employe = (select private.employe_courant())
    or private.meme_boutique(id_employe)
  );
-- Écriture : ses propres événements ; le responsable pour son équipe ; l'admin pour tous.
create policy calendrier_insert on public.calendrier_evenements for insert to authenticated
  with check (
    (select private.role_courant()) = 'Administrateur'
    or id_employe = (select private.employe_courant())
    or ((select private.role_courant()) = 'Responsable' and private.meme_boutique(id_employe))
  );
create policy calendrier_update on public.calendrier_evenements for update to authenticated
  using (
    (select private.role_courant()) = 'Administrateur'
    or id_employe = (select private.employe_courant())
    or ((select private.role_courant()) = 'Responsable' and private.meme_boutique(id_employe))
  )
  with check (
    (select private.role_courant()) = 'Administrateur'
    or id_employe = (select private.employe_courant())
    or ((select private.role_courant()) = 'Responsable' and private.meme_boutique(id_employe))
  );
create policy calendrier_delete on public.calendrier_evenements for delete to authenticated
  using (
    (select private.role_courant()) = 'Administrateur'
    or id_employe = (select private.employe_courant())
    or ((select private.role_courant()) = 'Responsable' and private.meme_boutique(id_employe))
  );

-- reparations -----------------------------------------------------------------------------
create policy reparations_select on public.reparations for select to authenticated
  using (
    (select private.role_courant()) = 'Administrateur'
    or ((select private.role_courant()) = 'Responsable' and id_boutique = (select private.boutique_courante()))
    or ((select private.role_courant()) = 'Technicien' and id_technicien = (select private.employe_courant()))
  );
create policy reparations_insert on public.reparations for insert to authenticated
  with check (
    (select private.role_courant()) = 'Responsable' and id_boutique = (select private.boutique_courante())
  );
create policy reparations_update on public.reparations for update to authenticated
  using (
    (select private.role_courant()) = 'Administrateur'
    or ((select private.role_courant()) = 'Responsable' and id_boutique = (select private.boutique_courante()))
    or ((select private.role_courant()) = 'Technicien' and id_technicien = (select private.employe_courant()))
  )
  with check (
    (select private.role_courant()) = 'Administrateur'
    or ((select private.role_courant()) = 'Responsable' and id_boutique = (select private.boutique_courante()))
    or ((select private.role_courant()) = 'Technicien' and id_technicien = (select private.employe_courant()))
  );
create policy reparations_delete on public.reparations for delete to authenticated
  using ((select private.role_courant()) = 'Administrateur');

-- historique_statuts : suit les droits sur la réparation -----------------------------------
create policy historique_select on public.historique_statuts for select to authenticated
  using (private.peut_voir_reparation(id_reparation));
create policy historique_insert on public.historique_statuts for insert to authenticated
  with check (private.peut_voir_reparation(id_reparation));
create policy historique_update on public.historique_statuts for update to authenticated
  using (private.peut_voir_reparation(id_reparation))
  with check (private.peut_voir_reparation(id_reparation));

-- clients (données personnelles) ----------------------------------------------------------
-- Responsables et admin : tous (recherche d'un client existant par e-mail à la création
-- d'un ticket). Technicien : seulement les clients de ses réparations.
create policy clients_select on public.clients for select to authenticated
  using (
    (select private.role_courant()) in ('Administrateur', 'Responsable')
    or ((select private.role_courant()) = 'Technicien' and private.client_du_technicien(id_client))
  );
create policy clients_insert on public.clients for insert to authenticated
  with check ((select private.role_courant()) in ('Administrateur', 'Responsable'));
create policy clients_update on public.clients for update to authenticated
  using ((select private.role_courant()) in ('Administrateur', 'Responsable'))
  with check ((select private.role_courant()) in ('Administrateur', 'Responsable'));

-- appareils ---------------------------------------------------------------------------------
create policy appareils_select on public.appareils for select to authenticated
  using (
    (select private.role_courant()) in ('Administrateur', 'Responsable')
    or ((select private.role_courant()) = 'Technicien' and private.appareil_du_technicien(id_appareil))
  );
create policy appareils_insert on public.appareils for insert to authenticated
  with check ((select private.role_courant()) in ('Administrateur', 'Responsable'));
create policy appareils_update on public.appareils for update to authenticated
  using ((select private.role_courant()) in ('Administrateur', 'Responsable'))
  with check ((select private.role_courant()) in ('Administrateur', 'Responsable'));

-- factures ------------------------------------------------------------------------------------
create policy factures_select on public.factures for select to authenticated
  using (private.peut_voir_reparation(id_reparation));
create policy factures_insert on public.factures for insert to authenticated
  with check (
    (select private.role_courant()) = 'Responsable' and private.peut_voir_reparation(id_reparation)
  );

commit;
