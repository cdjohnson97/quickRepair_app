import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';

// Ne jamais renvoyer mot_de_passe_hash (mots de passe en clair sur d'anciens comptes de
// test) ni id_auth au client — cette liste explicite évite qu'un futur champ sensible
// ajouté à la table se retrouve exposé par accident via un findUnique() sans select.
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

// Auth basée sur les comptes Supabase existants : le mot de passe (hash bcrypt) reste
// dans auth.users (schéma géré par Supabase Auth, lu ici en direct via Prisma) — on ne
// touche pas employes.mot_de_passe_hash, qui ne contient que des mots de passe en clair
// de comptes de test et n'est pas une source fiable.
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService
  ) {}

  async login({ email, password }: LoginDto) {
    const authUser = await this.prisma.users.findFirst({
      where: { email },
      select: { id: true, encrypted_password: true }
    });
    if (!authUser?.encrypted_password) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    const passwordMatches = await bcrypt.compare(password, authUser.encrypted_password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    // L'employé est retrouvé par le compte (id_auth), jamais par l'e-mail : les inscriptions
    // Supabase sont ouvertes, et un inconnu pourrait sinon créer un compte avec l'e-mail d'un
    // employé qui n'en a pas encore et obtenir un jeton à son nom. Même règle que le RLS.
    const employe = await this.prisma.employes.findFirst({
      where: { id_auth: authUser.id },
      select: EMPLOYE_PUBLIC_FIELDS
    });
    if (!employe) {
      throw new UnauthorizedException("Ce compte n'a pas accès à l'espace employé.");
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
