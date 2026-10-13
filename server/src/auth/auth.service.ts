import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseAuthClient } from './supabase-auth.client.js';

// Ne jamais renvoyer mot_de_passe_hash ni id_auth au client — cette liste explicite évite
// qu'un futur champ sensible ajouté à la table se retrouve exposé par accident via un
// findUnique() sans select.
const EMPLOYE_PUBLIC_FIELDS = {
  id_employe: true,
  nom: true,
  prenom: true,
  email: true,
  role: true,
  id_boutique: true,
  telephone: true,
  avatar_url: true,
  last_seen: true,
  boutiques: { select: { nom: true, ville: true } }
} as const;

// La connexion (mot de passe puis code 2FA) se fait auprès de Supabase Auth. L'API ne voit
// jamais le mot de passe : elle échange une session Supabase validée, de niveau aal2
// (mot de passe + code vérifiés), contre son propre jeton. Le 2FA est obligatoire pour tous.
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private supabaseAuth: SupabaseAuthClient
  ) {}

  async createSession(supabaseAccessToken: string | undefined) {
    if (!supabaseAccessToken) {
      throw new UnauthorizedException('Session Supabase manquante.');
    }

    const session = await this.supabaseAuth.verifySession(supabaseAccessToken);
    if (!session) {
      throw new UnauthorizedException('Session invalide ou expirée.');
    }
    if (session.aal !== 'aal2') {
      throw new ForbiddenException('Double authentification requise.');
    }

    // L'employé est retrouvé par le compte (id_auth), jamais par l'e-mail : les inscriptions
    // Supabase sont ouvertes, et un inconnu pourrait sinon créer un compte avec l'e-mail d'un
    // employé qui n'en a pas encore et obtenir un jeton à son nom. Même règle que le RLS.
    const employe = await this.prisma.employes.findFirst({
      where: { id_auth: session.userId },
      select: EMPLOYE_PUBLIC_FIELDS
    });
    if (!employe) {
      throw new ForbiddenException("Ce compte n'a pas accès à l'espace employé.");
    }

    const payload = {
      sub: employe.id_employe,
      email: employe.email!,
      role: employe.role as 'Administrateur' | 'Responsable' | 'Technicien',
      id_boutique: employe.id_boutique
    };

    return {
      access_token: await this.jwt.signAsync(payload),
      user: employe
    };
  }

  async me(idEmploye: number) {
    return this.prisma.employes.findUnique({
      where: { id_employe: idEmploye },
      select: EMPLOYE_PUBLIC_FIELDS
    });
  }
}
