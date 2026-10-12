import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { createPrismaMock, PrismaMock } from '../../test/helpers/prisma-mock.js';

const PASSWORD = 'motdepasse-solide';
const AUTH_UUID = '00000000-0000-4000-8000-000000000007';
// Coût 4 : suffisant pour tester la vraie comparaison bcrypt sans ralentir la suite.
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

const EMPLOYE = {
  id_employe: 7,
  nom: 'Dupont',
  prenom: 'Jean',
  email: 'jean@fixeo.fr',
  role: 'Technicien',
  id_boutique: 3,
  telephone: null,
  avatar_url: null,
  last_seen: null,
  boutiques: { nom: 'FiXeo Lyon', ville: 'Lyon' }
};

describe('AuthService', () => {
  let prisma: PrismaMock;
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    jwt = { signAsync: vi.fn().mockResolvedValue('signed.jwt.token') };
    service = new AuthService(prisma, jwt as any);
  });

  describe('login', () => {
    it("refuse un email inconnu de auth.users, sans consulter la table employes", async () => {
      prisma.users.findFirst.mockResolvedValue(null);

      await expect(service.login({ email: EMPLOYE.email, password: PASSWORD })).rejects.toThrow(
        new UnauthorizedException('Identifiants incorrects.')
      );
      expect(prisma.employes.findFirst).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('refuse un compte sans mot de passe (encrypted_password null)', async () => {
      prisma.users.findFirst.mockResolvedValue({ id: AUTH_UUID, encrypted_password: null });

      await expect(service.login({ email: EMPLOYE.email, password: PASSWORD })).rejects.toThrow(
        UnauthorizedException
      );
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('refuse un mauvais mot de passe avec le même message que pour un email inconnu', async () => {
      prisma.users.findFirst.mockResolvedValue({ id: AUTH_UUID, encrypted_password: PASSWORD_HASH });

      await expect(service.login({ email: EMPLOYE.email, password: 'mauvais' })).rejects.toThrow(
        new UnauthorizedException('Identifiants incorrects.')
      );
      expect(prisma.employes.findFirst).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it("refuse un compte valide qui n'est pas un employé (ex. client)", async () => {
      prisma.users.findFirst.mockResolvedValue({ id: AUTH_UUID, encrypted_password: PASSWORD_HASH });
      prisma.employes.findFirst.mockResolvedValue(null);

      await expect(service.login({ email: 'client@mail.fr', password: PASSWORD })).rejects.toThrow(
        new UnauthorizedException("Ce compte n'a pas accès à l'espace employé.")
      );
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it("émet un JWT dont le payload contient sub, email, role et id_boutique", async () => {
      prisma.users.findFirst.mockResolvedValue({ id: AUTH_UUID, encrypted_password: PASSWORD_HASH });
      prisma.employes.findFirst.mockResolvedValue(EMPLOYE);

      const result = await service.login({ email: EMPLOYE.email, password: PASSWORD });

      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 7,
        email: 'jean@fixeo.fr',
        role: 'Technicien',
        id_boutique: 3
      });
      expect(result).toEqual({ access_token: 'signed.jwt.token', user: EMPLOYE });
    });

    it("retrouve l'employé par id_auth (compte Supabase), jamais par e-mail", async () => {
      prisma.users.findFirst.mockResolvedValue({ id: AUTH_UUID, encrypted_password: PASSWORD_HASH });
      prisma.employes.findFirst.mockResolvedValue(EMPLOYE);

      await service.login({ email: EMPLOYE.email, password: PASSWORD });

      const { where } = prisma.employes.findFirst.mock.calls[0][0];
      expect(where).toEqual({ id_auth: AUTH_UUID });
    });

    it("cherche le compte par email dans auth.users et n'en sélectionne que l'id et le hash", async () => {
      prisma.users.findFirst.mockResolvedValue({ id: AUTH_UUID, encrypted_password: PASSWORD_HASH });
      prisma.employes.findFirst.mockResolvedValue(EMPLOYE);

      await service.login({ email: EMPLOYE.email, password: PASSWORD });

      expect(prisma.users.findFirst).toHaveBeenCalledWith({
        where: { email: EMPLOYE.email },
        select: { id: true, encrypted_password: true }
      });
    });

    it('ne demande jamais mot_de_passe_hash ni id_auth pour la réponse envoyée au client', async () => {
      prisma.users.findFirst.mockResolvedValue({ id: AUTH_UUID, encrypted_password: PASSWORD_HASH });
      prisma.employes.findFirst.mockResolvedValue(EMPLOYE);

      await service.login({ email: EMPLOYE.email, password: PASSWORD });

      const { select } = prisma.employes.findFirst.mock.calls[0][0];
      expect(select).toBeDefined();
      expect(select).not.toHaveProperty('mot_de_passe_hash');
      expect(select).not.toHaveProperty('id_auth');
      expect(select).not.toHaveProperty('push_token');
    });
  });

  describe('me', () => {
    it("retourne le profil public de l'employé identifié par le token", async () => {
      prisma.employes.findUnique.mockResolvedValue(EMPLOYE);

      const result = await service.me(7);

      expect(result).toEqual(EMPLOYE);
      const call = prisma.employes.findUnique.mock.calls[0][0];
      expect(call.where).toEqual({ id_employe: 7 });
      expect(call.select).not.toHaveProperty('mot_de_passe_hash');
    });
  });
});
