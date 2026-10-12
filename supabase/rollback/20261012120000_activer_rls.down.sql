-- =====================================================================================
-- Annulation de supabase/migrations/20261012120000_activer_rls.sql
-- À n'utiliser qu'en cas de blocage en production : rouvre l'accès complet aux tables.
-- Les corrections de données (id_auth rattachés, mot_de_passe_hash vidé, id_boutique des
-- réparations) ne sont PAS annulées : elles corrigent des incohérences.
-- =====================================================================================

begin;

-- Règles d'accès
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('employes','boutiques','statuts','types_reparation','messages','calendrier_evenements',
                        'reparations','historique_statuts','clients','appareils','factures')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- RLS désactivé (état antérieur : seul factures l'avait, avec une règle ouverte)
alter table public.appareils             disable row level security;
alter table public.boutiques             disable row level security;
alter table public.calendrier_evenements disable row level security;
alter table public.clients               disable row level security;
alter table public.employes              disable row level security;
alter table public.fournisseurs          disable row level security;
alter table public.historique_statuts    disable row level security;
alter table public.messages              disable row level security;
alter table public.pieces                disable row level security;
alter table public.reparations           disable row level security;
alter table public.statuts               disable row level security;
alter table public.stock_boutique        disable row level security;
alter table public.types_reparation      disable row level security;
create policy "Tout le monde peut gérer les factures" on public.factures for all to public using (true) with check (true);

-- Droits d'origine
grant all on all tables in schema public to anon;
grant all on all tables in schema public to authenticated;
alter default privileges for role postgres in schema public grant all on tables to anon;

-- Triggers et fonctions
drop trigger if exists proteger_colonnes_employe on public.employes;
drop trigger if exists reparation_boutique_par_defaut on public.reparations;
drop schema if exists private cascade;

create or replace function public.log_changement_statut()
returns trigger
language plpgsql
as $$
begin
  if old.id_statut_actuel is distinct from new.id_statut_actuel then
    insert into historique_statuts (id_reparation, id_statut, date_changement, id_employe, commentaire)
    values (new.id_reparation, new.id_statut_actuel, now(), new.id_technicien,
            'Mise à jour automatique suite au changement de statut.');
  end if;
  return new;
end;
$$;

commit;
