import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module.js';
import { SupabaseAuthClient } from '../src/auth/supabase-auth.client.js';
import { BoutiquesModule } from '../src/boutiques/boutiques.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ReparationsGateway } from '../src/reparations/reparations.gateway.js';
import { PushService } from '../src/notifications/push.service.js';
import { ReparationsModule } from '../src/reparations/reparations.module.js';
import { configureApp } from '../src/app.setup.js';
import { createPrismaMock, PrismaMock } from './helpers/prisma-mock.js';

// Tests HTTP de bout en bout de la couche API : vraies routes, vrais guards (JWT + rôles),
// vrai ValidationPipe et vraie signature JWT. Seuls Prisma, Supabase Auth et la passerelle
// Socket.IO sont simulés — aucun accès à Supabase (le ConfigModule ignore volontairement
// server/.env). La configuration HTTP est celle de main.ts (configureApp). La limitation de
// débit (SecurityModule) est testée à part dans security.e2e-spec.ts.

const JWT_SECRET = 'secret-de-test-e2e';

type Role = 'Administrateur' | 'Responsable' | 'Technicien';

describe('API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;
  let jwt: JwtService;
  let gateway: { notifyRepairAssigned: ReturnType<typeof vi.fn> };
  let push: { notifyEmployee: ReturnType<typeof vi.fn> };
  let supabaseAuth: { verifySession: ReturnType<typeof vi.fn> };

  const tokenFor = (role: Role, sub = 1, id_boutique: number | null = 3) =>
    jwt.signAsync({ sub, email: `user${sub}@fixeo.fr`, role, id_boutique });

  const bearer = async (role: Role, sub?: number, id_boutique?: number | null) =>
    `Bearer ${await tokenFor(role, sub, id_boutique)}`;

  beforeAll(async () => {
    prisma = createPrismaMock();
    gateway = { notifyRepairAssigned: vi.fn() };
    push = { notifyEmployee: vi.fn().mockResolvedValue(true) };
    supabaseAuth = { verifySession: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET, JWT_EXPIRES_IN: '1h' })]
        }),
        PrismaModule,
        AuthModule,
        ReparationsModule,
        BoutiquesModule
      ]
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ReparationsGateway)
      .useValue(gateway)
      .overrideProvider(PushService)
      .useValue(push)
      .overrideProvider(SupabaseAuthClient)
      .useValue(supabaseAuth)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication);
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Efface appels et valeurs programmées entre deux tests (les mocks vivent le temps de l'app).
    for (const model of Object.values(prisma) as any[]) {
      for (const fn of Object.values(model)) (fn as any)?.mockReset?.();
    }
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg as Promise<unknown>[])
    );
    gateway.notifyRepairAssigned.mockReset();
    supabaseAuth.verifySession.mockReset();
  });

  describe('authentification', () => {
    const AUTH_UUID = '00000000-0000-4000-8000-000000000007';
    const employe = {
      id_employe: 7,
      nom: 'Dupont',
      prenom: 'Jean',
      email: 'jean@fixeo.fr',
      role: 'Technicien',
      id_boutique: 3,
      telephone: null,
      avatar_url: null,
      last_seen: null,
      boutiques: { nom: 'Lyon', ville: 'Lyon' }
    };

    const SUPABASE_TOKEN = 'jeton.supabase.de-test';
    const session = (token?: string) => {
      const req = request(app.getHttpServer()).post('/api/auth/session');
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    };

    it("POST /auth/login n'existe plus (connexion par mot de passe seul supprimée)", async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: employe.email, password: 'motdepasse' })
        .expect(404);
    });

    it('POST /auth/session : 401 sans jeton Supabase', async () => {
      await session().expect(401);
      expect(supabaseAuth.verifySession).not.toHaveBeenCalled();
    });

    it('POST /auth/session : 401 pour une session Supabase invalide ou expirée', async () => {
      supabaseAuth.verifySession.mockResolvedValue(null);

      const res = await session(SUPABASE_TOKEN).expect(401);

      expect(res.body.message).toBe('Session invalide ou expirée.');
      expect(supabaseAuth.verifySession).toHaveBeenCalledWith(SUPABASE_TOKEN);
    });

    it('POST /auth/session : 403 pour une session au mot de passe seul (aal1)', async () => {
      supabaseAuth.verifySession.mockResolvedValue({ userId: AUTH_UUID, aal: 'aal1' });

      const res = await session(SUPABASE_TOKEN).expect(403);

      expect(res.body.message).toBe('Double authentification requise.');
      expect(prisma.employes.findFirst).not.toHaveBeenCalled();
    });

    it("POST /auth/session : 403 si le compte n'est rattaché à aucun employé (recherche par id_auth)", async () => {
      supabaseAuth.verifySession.mockResolvedValue({ userId: AUTH_UUID, aal: 'aal2' });
      prisma.employes.findFirst.mockResolvedValue(null);

      await session(SUPABASE_TOKEN).expect(403);

      expect(prisma.employes.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id_auth: AUTH_UUID } }));
    });

    it('POST /auth/session : renvoie un token et le profil public pour une session aal2', async () => {
      supabaseAuth.verifySession.mockResolvedValue({ userId: AUTH_UUID, aal: 'aal2' });
      prisma.employes.findFirst.mockResolvedValue(employe);

      const res = await session(SUPABASE_TOKEN).expect(201);

      expect(res.body.access_token).toEqual(expect.any(String));
      expect(res.body.user).toEqual(employe);
      expect(res.body.user).not.toHaveProperty('mot_de_passe_hash');
      expect(res.body.user).not.toHaveProperty('id_auth');
    });

    it('le token émis par /auth/session ouvre GET /auth/me', async () => {
      supabaseAuth.verifySession.mockResolvedValue({ userId: AUTH_UUID, aal: 'aal2' });
      prisma.employes.findFirst.mockResolvedValue(employe);
      prisma.employes.findUnique.mockResolvedValue(employe);

      const login = await session(SUPABASE_TOKEN);

      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.access_token}`)
        .expect(200);

      expect(me.body).toEqual(employe);
      expect(prisma.employes.findUnique).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { id_employe: 7 } })
      );
    });

    it('GET /auth/me : 401 sans token, avec un token invalide ou avec un token expiré', async () => {
      const server = app.getHttpServer();
      await request(server).get('/api/auth/me').expect(401);
      await request(server).get('/api/auth/me').set('Authorization', 'Bearer n-importe-quoi').expect(401);

      const expired = await jwt.signAsync({ sub: 7, role: 'Technicien' }, { expiresIn: -60 });
      await request(server).get('/api/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    });

    it("GET /auth/me : 401 pour un token signé avec une autre clé", async () => {
      const forged = await new JwtService({ secret: 'autre-secret' }).signAsync({ sub: 7, role: 'Administrateur' });

      await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
    });
  });

  describe('GET /reparations/track/:numeroSuivi (public)', () => {
    it('répond sans token', async () => {
      prisma.reparations.findFirst.mockResolvedValue({
        id_reparation: 42,
        numero_suivi: 'QR-12345',
        id_statut_actuel: 5,
        statuts: { libelle: 'En cours' },
        appareils: { marque: 'Apple', modele: 'iPhone 13', clients: { nom: 'Martin', prenom: 'Léa' } },
        factures: []
      });
      prisma.historique_statuts.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer()).get('/api/reparations/track/QR-12345').expect(200);

      expect(res.body.numero_suivi).toBe('QR-12345');
      expect(res.body.historique_statuts).toEqual([]);
    });

    it('404 pour un numéro inconnu', async () => {
      prisma.reparations.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).get('/api/reparations/track/QR-00000').expect(404);

      expect(res.body.message).toBe('Aucune réparation trouvée pour ce numéro de suivi.');
    });
  });

  describe('GET /reparations', () => {
    it('401 sans token', async () => {
      await request(app.getHttpServer()).get('/api/reparations').expect(401);
      expect(prisma.reparations.findMany).not.toHaveBeenCalled();
    });

    it("un technicien reçoit uniquement ses réparations (filtre issu du token, pas de la requête)", async () => {
      prisma.reparations.findMany.mockResolvedValue([{ id_reparation: 1 }]);

      const res = await request(app.getHttpServer())
        .get('/api/reparations?id_technicien=999')
        .set('Authorization', await bearer('Technicien', 7))
        .expect(200);

      expect(res.body).toEqual([{ id_reparation: 1 }]);
      expect(prisma.reparations.findMany.mock.calls[0][0].where).toEqual({ id_technicien: 7 });
    });

    it('un responsable reçoit les réparations des techniciens de sa boutique', async () => {
      prisma.employes.findMany.mockResolvedValue([{ id_employe: 10 }]);
      prisma.reparations.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/reparations')
        .set('Authorization', await bearer('Responsable', 1, 3))
        .expect(200);

      expect(prisma.employes.findMany.mock.calls[0][0].where).toEqual({ role: 'Technicien', id_boutique: 3 });
      expect(prisma.reparations.findMany.mock.calls[0][0].where).toEqual({ id_technicien: { in: [10] } });
    });
  });

  describe('GET /reparations/:id/history', () => {
    it('401 sans token', async () => {
      await request(app.getHttpServer()).get('/api/reparations/42/history').expect(401);
    });

    it("200 avec un token valide", async () => {
      prisma.historique_statuts.findMany.mockResolvedValue([{ id_historique: 1 }]);

      const res = await request(app.getHttpServer())
        .get('/api/reparations/42/history')
        .set('Authorization', await bearer('Technicien', 7))
        .expect(200);

      expect(res.body).toEqual([{ id_historique: 1 }]);
      expect(prisma.historique_statuts.findMany.mock.calls[0][0].where).toEqual({ id_reparation: 42 });
    });
  });

  describe('POST /reparations', () => {
    const body = {
      clientNom: 'Martin',
      clientPrenom: 'Léa',
      clientEmail: 'lea@mail.fr',
      marque: 'Apple',
      modele: 'iPhone 13',
      descriptionPanne: 'Écran cassé',
      idTechnicien: 7
    };

    beforeEach(() => {
      prisma.clients.upsert.mockResolvedValue({ id_client: 20 });
      prisma.appareils.create.mockResolvedValue({ id_appareil: 30 });
      prisma.reparations.create.mockResolvedValue({ id_reparation: 42, numero_suivi: 'QR-12345' });
    });

    it('401 sans token', async () => {
      await request(app.getHttpServer()).post('/api/reparations').send(body).expect(401);
    });

    it('403 pour un technicien', async () => {
      await request(app.getHttpServer())
        .post('/api/reparations')
        .set('Authorization', await bearer('Technicien', 7))
        .send(body)
        .expect(403);
      expect(prisma.reparations.create).not.toHaveBeenCalled();
    });

    it('403 pour un administrateur (réservé aux responsables)', async () => {
      await request(app.getHttpServer())
        .post('/api/reparations')
        .set('Authorization', await bearer('Administrateur'))
        .send(body)
        .expect(403);
    });

    it('400 avec un corps invalide, sans rien écrire en base', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reparations')
        .set('Authorization', await bearer('Responsable'))
        .send({ ...body, clientEmail: 'pas-un-email', idTechnicien: '7' })
        .expect(400);

      expect(res.body.message).toEqual(expect.arrayContaining([expect.stringContaining('clientEmail')]));
      expect(prisma.clients.upsert).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("201 pour un responsable : crée la réparation dans SA boutique (issue du token) et notifie le technicien", async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reparations')
        .set('Authorization', await bearer('Responsable', 1, 3))
        .send({ ...body, id_boutique: 99, id_statut_actuel: 9 })
        .expect(201);

      expect(res.body).toEqual({ id_reparation: 42, numero_suivi: 'QR-12345' });
      const { data } = prisma.reparations.create.mock.calls[0][0];
      expect(data.id_boutique).toBe(3);
      expect(data.id_statut_actuel).toBe(1);
      expect(gateway.notifyRepairAssigned).toHaveBeenCalledWith(7, res.body);
      expect(push.notifyEmployee).toHaveBeenCalledWith(7, expect.any(String), expect.stringContaining('QR-12345'), { type: 'repair', repairId: 42 });
    });
  });

  describe('PATCH /reparations/:id/status', () => {
    beforeEach(() => {
      prisma.reparations.update.mockResolvedValue({ id_reparation: 42, id_statut_actuel: 5 });
    });

    it('401 sans token', async () => {
      await request(app.getHttpServer()).patch('/api/reparations/42/status').send({ idStatut: 5 }).expect(401);
    });

    it('400 quand idStatut est absent ou envoyé en chaîne', async () => {
      const auth = await bearer('Technicien', 7);
      await request(app.getHttpServer()).patch('/api/reparations/42/status').set('Authorization', auth).send({}).expect(400);
      await request(app.getHttpServer())
        .patch('/api/reparations/42/status')
        .set('Authorization', auth)
        .send({ idStatut: '5' })
        .expect(400);
      expect(prisma.reparations.update).not.toHaveBeenCalled();
    });

    it('404 pour une réparation inexistante', async () => {
      prisma.reparations.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch('/api/reparations/999/status')
        .set('Authorization', await bearer('Technicien', 7))
        .send({ idStatut: 5 })
        .expect(404);
    });

    it("403 pour un technicien sur la réparation d'un collègue", async () => {
      prisma.reparations.findUnique.mockResolvedValue({ id_reparation: 42, id_technicien: 8 });

      await request(app.getHttpServer())
        .patch('/api/reparations/42/status')
        .set('Authorization', await bearer('Technicien', 7))
        .send({ idStatut: 5 })
        .expect(403);
      expect(prisma.reparations.update).not.toHaveBeenCalled();
    });

    it('200 pour le technicien assigné, avec commentaire', async () => {
      prisma.reparations.findUnique.mockResolvedValue({ id_reparation: 42, id_technicien: 7 });
      prisma.historique_statuts.findFirst.mockResolvedValue({ id_historique: 100 });

      const res = await request(app.getHttpServer())
        .patch('/api/reparations/42/status')
        .set('Authorization', await bearer('Technicien', 7))
        .send({ idStatut: 5, commentaire: 'Pièce reçue' })
        .expect(200);

      expect(res.body).toEqual({ id_reparation: 42, id_statut_actuel: 5 });
      expect(prisma.historique_statuts.update).toHaveBeenCalledWith({
        where: { id_historique: 100 },
        data: { commentaire: 'Pièce reçue' }
      });
    });
  });

  describe('POST /reparations/:id/invoice', () => {
    const body = { montantTotal: 149.9, modePaiement: 'Carte bancaire' };

    beforeEach(() => {
      prisma.reparations.findUnique.mockResolvedValue({ id_reparation: 42 });
      prisma.factures.create.mockResolvedValue({ id_facture: 1, numero_facture: 'FAC-2026-1234' });
      prisma.reparations.update.mockResolvedValue({ id_reparation: 42, id_statut_actuel: 8 });
    });

    it('401 sans token, 403 pour un technicien', async () => {
      await request(app.getHttpServer()).post('/api/reparations/42/invoice').send(body).expect(401);
      await request(app.getHttpServer())
        .post('/api/reparations/42/invoice')
        .set('Authorization', await bearer('Technicien', 7))
        .send(body)
        .expect(403);
      expect(prisma.factures.create).not.toHaveBeenCalled();
    });

    it.each([0, -10, '100'])('400 pour le montant %j', async (montantTotal) => {
      await request(app.getHttpServer())
        .post('/api/reparations/42/invoice')
        .set('Authorization', await bearer('Responsable'))
        .send({ ...body, montantTotal })
        .expect(400);
      expect(prisma.factures.create).not.toHaveBeenCalled();
    });

    it('201 pour un responsable : facture créée et réparation passée au statut 8', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reparations/42/invoice')
        .set('Authorization', await bearer('Responsable'))
        .send(body)
        .expect(201);

      expect(res.body).toEqual({ id_facture: 1, numero_facture: 'FAC-2026-1234' });
      expect(prisma.reparations.update).toHaveBeenCalledWith({
        where: { id_reparation: 42 },
        data: { id_statut_actuel: 8 }
      });
    });
  });

  describe('/boutiques', () => {
    it('GET : 401 sans token', async () => {
      await request(app.getHttpServer()).get('/api/boutiques').expect(401);
    });

    it('GET : tout employé connecté reçoit les boutiques avec des coordonnées numériques', async () => {
      prisma.boutiques.findMany.mockResolvedValue([
        {
          id_boutique: 1,
          nom: 'Lyon',
          latitude: new Prisma.Decimal('45.76400000'),
          longitude: new Prisma.Decimal('4.83570000')
        }
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/boutiques')
        .set('Authorization', await bearer('Technicien', 7))
        .expect(200);

      expect(res.body[0].latitude).toBe(45.764);
      expect(res.body[0].longitude).toBe(4.8357);
    });

    it('GET /public : accessible sans token, colonnes publiques uniquement', async () => {
      prisma.boutiques.findMany.mockResolvedValue([
        {
          id_boutique: 1,
          nom: 'FiXeo Lyon',
          ville: 'Lyon',
          telephone: '0400000000',
          latitude: new Prisma.Decimal('45.76400000'),
          longitude: new Prisma.Decimal('4.83570000')
        }
      ]);

      const res = await request(app.getHttpServer()).get('/api/boutiques/public').expect(200);

      expect(res.body[0]).toMatchObject({ nom: 'FiXeo Lyon', latitude: 45.764, longitude: 4.8357 });
      const [args] = prisma.boutiques.findMany.mock.calls[0];
      expect(args.select).not.toHaveProperty('employes');
      expect(args.select).not.toHaveProperty('reparations');
    });

    it.each<Role>(['Responsable', 'Technicien'])('POST : 403 pour le rôle %s', async (role) => {
      await request(app.getHttpServer())
        .post('/api/boutiques')
        .set('Authorization', await bearer(role))
        .send({ nom: 'Paris' })
        .expect(403);
      expect(prisma.boutiques.create).not.toHaveBeenCalled();
    });

    it('POST : 400 pour un nom manquant ou une latitude hors limites', async () => {
      const auth = await bearer('Administrateur');
      await request(app.getHttpServer()).post('/api/boutiques').set('Authorization', auth).send({}).expect(400);
      await request(app.getHttpServer())
        .post('/api/boutiques')
        .set('Authorization', auth)
        .send({ nom: 'Paris', latitude: 123 })
        .expect(400);
      expect(prisma.boutiques.create).not.toHaveBeenCalled();
    });

    it('POST : 201 pour un administrateur', async () => {
      prisma.boutiques.create.mockResolvedValue({
        id_boutique: 9,
        nom: 'Paris',
        latitude: new Prisma.Decimal('48.85660000'),
        longitude: null
      });

      const res = await request(app.getHttpServer())
        .post('/api/boutiques')
        .set('Authorization', await bearer('Administrateur'))
        .send({ nom: 'Paris', latitude: 48.8566 })
        .expect(201);

      expect(res.body).toEqual({ id_boutique: 9, nom: 'Paris', latitude: 48.8566, longitude: null });
      expect(prisma.boutiques.create).toHaveBeenCalledWith({ data: { nom: 'Paris', latitude: 48.8566 } });
    });

    it('POST : 400 pour un e-mail ou un téléphone invalide', async () => {
      const auth = await bearer('Administrateur');
      await request(app.getHttpServer())
        .post('/api/boutiques')
        .set('Authorization', auth)
        .send({ nom: 'Paris', email_contact: 'pas-un-email' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/boutiques')
        .set('Authorization', auth)
        .send({ nom: 'Paris', telephone: '<script>' })
        .expect(400);
      expect(prisma.boutiques.create).not.toHaveBeenCalled();
    });

    it('PATCH : 401 sans token, 403 pour un responsable', async () => {
      await request(app.getHttpServer()).patch('/api/boutiques/1').send({ telephone: '0100000000' }).expect(401);
      await request(app.getHttpServer())
        .patch('/api/boutiques/1')
        .set('Authorization', await bearer('Responsable'))
        .send({ telephone: '0100000000' })
        .expect(403);
      expect(prisma.boutiques.update).not.toHaveBeenCalled();
    });

    it('PATCH : 400 pour un identifiant non numérique ou un nom vidé', async () => {
      const auth = await bearer('Administrateur');
      await request(app.getHttpServer()).patch('/api/boutiques/abc').set('Authorization', auth).send({}).expect(400);
      await request(app.getHttpServer()).patch('/api/boutiques/1').set('Authorization', auth).send({ nom: '' }).expect(400);
      expect(prisma.boutiques.update).not.toHaveBeenCalled();
    });

    it('PATCH : 404 pour une boutique inexistante', async () => {
      prisma.boutiques.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch('/api/boutiques/999')
        .set('Authorization', await bearer('Administrateur'))
        .send({ telephone: '0100000000' })
        .expect(404);
    });

    it('PATCH : 200 pour un administrateur, champs inconnus ignorés', async () => {
      prisma.boutiques.findUnique.mockResolvedValue({ id_boutique: 1, nom: 'Lyon' });
      prisma.boutiques.update.mockResolvedValue({
        id_boutique: 1,
        nom: 'Lyon',
        telephone: '04 00 00 00 00',
        email_contact: 'lyon@fixeo.fr',
        latitude: null,
        longitude: null
      });

      const res = await request(app.getHttpServer())
        .patch('/api/boutiques/1')
        .set('Authorization', await bearer('Administrateur'))
        .send({ telephone: '04 00 00 00 00', email_contact: 'lyon@fixeo.fr', id_boutique: 42 })
        .expect(200);

      expect(res.body.email_contact).toBe('lyon@fixeo.fr');
      expect(prisma.boutiques.update).toHaveBeenCalledWith({
        where: { id_boutique: 1 },
        data: { telephone: '04 00 00 00 00', email_contact: 'lyon@fixeo.fr' }
      });
    });
  });
});
