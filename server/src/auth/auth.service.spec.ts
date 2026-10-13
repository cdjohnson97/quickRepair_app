import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { createPrismaMock, PrismaMock } from '../../test/helpers/prisma-mock.js';

const AUTH_UUID = '00000000-0000-4000-8000-000000000007';
const SUPABASE_TOKEN = 'jeton.supabase.valide';

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
  let supabaseAuth: { verifySession: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    jwt = { signAsync: vi.fn().mockResolvedValue('signed.jwt.token') };
    supabaseAuth = { verifySession: vi.fn() };
    service = new AuthService(prisma, jwt as any, supabaseAuth as any);
  });

  describe('createSession (2FA obligatoire)', () => {
    it('refuse une requête sans jeton Supabase, sans rien interroger', async () => {
      await expect(service.createSession(undefined)).rejects.toThrow(
        new UnauthorizedException('Session Supabase manquante.')
      );
      expect(supabaseAuth.verifySession).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('refuse une session invalide, expirée ou révoquée', async () => {
      supabaseAuth.verifySession.mockResolvedValue(null);

      await expect(service.createSession(SUPABASE_TOKEN)).rejects.toThrow(
        new UnauthorizedException('Session invalide ou expirée.')
      );
      expect(prisma.employes.findFirst).not.toHaveBeenCalled();
    });

    it('refuse une session au mot de passe seul (aal1) : le code 2FA est obligatoire', async () => {
      supabaseAuth.verifySession.mockResolvedValue({ userId: AUTH_UUID, aal: 'aal1' });

      await expect(service.createSession(SUPABASE_TOKEN)).rejects.toThrow(
        new ForbiddenException('Double authentification requise.')
      );
      expect(prisma.employes.findFirst).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it("refuse un compte 2FA valide qui n'est rattaché à aucun employé", async () => {
      supabaseAuth.verifySession.mockResolvedValue({ userId: AUTH_UUID, aal: 'aal2' });
      prisma.employes.findFirst.mockResolvedValue(null);

      await expect(service.createSession(SUPABASE_TOKEN)).rejects.toThrow(
        new ForbiddenException("Ce compte n'a pas accès à l'espace employé.")
      );
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it("retrouve l'employé par id_auth (compte Supabase), jamais par e-mail", async () => {
      supabaseAuth.verifySession.mockResolvedValue({ userId: AUTH_UUID, aal: 'aal2' });
      prisma.employes.findFirst.mockResolvedValue(EMPLOYE);

      await service.createSession(SUPABASE_TOKEN);

      expect(supabaseAuth.verifySession).toHaveBeenCalledWith(SUPABASE_TOKEN);
      const { where } = prisma.employes.findFirst.mock.calls[0][0];
      expect(where).toEqual({ id_auth: AUTH_UUID });
    });

    it('émet un JWT dont le payload contient sub, email, role et id_boutique', async () => {
      supabaseAuth.verifySession.mockResolvedValue({ userId: AUTH_UUID, aal: 'aal2' });
      prisma.employes.findFirst.mockResolvedValue(EMPLOYE);

      const result = await service.createSession(SUPABASE_TOKEN);

      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 7,
        email: 'jean@fixeo.fr',
        role: 'Technicien',
        id_boutique: 3
      });
      expect(result).toEqual({ access_token: 'signed.jwt.token', user: EMPLOYE });
    });

    it('ne demande jamais mot_de_passe_hash, id_auth ni push_token pour la réponse envoyée au client', async () => {
      supabaseAuth.verifySession.mockResolvedValue({ userId: AUTH_UUID, aal: 'aal2' });
      prisma.employes.findFirst.mockResolvedValue(EMPLOYE);

      await service.createSession(SUPABASE_TOKEN);

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
