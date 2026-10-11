import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.setup.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { PushService } from '../src/notifications/push.service.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ReparationsGateway } from '../src/reparations/reparations.gateway.js';
import { ReparationsModule } from '../src/reparations/reparations.module.js';
import { RATE_LIMITS, SecurityModule } from '../src/security/security.module.js';
import { createPrismaMock, PrismaMock } from './helpers/prisma-mock.js';

// Sécurité HTTP de bout en bout : en-têtes helmet et limitation de débit (anti force brute,
// anti énumération). Même configuration que main.ts ; Prisma est simulé (aucun accès à la base).
// Chaque test utilise sa propre adresse IP (X-Forwarded-For, pris en compte grâce à
// « trust proxy ») : les compteurs d'un test ne débordent pas sur le suivant.

const LOGIN_LIMIT = RATE_LIMITS.login.default.limit;
const TRACK_LIMIT = RATE_LIMITS.track.default.limit;

describe('Sécurité HTTP (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: 'secret-de-test-securite', JWT_EXPIRES_IN: '1h' })]
        }),
        SecurityModule,
        PrismaModule,
        AuthModule,
        ReparationsModule
      ]
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ReparationsGateway)
      .useValue({ notifyRepairAssigned: vi.fn() })
      .overrideProvider(PushService)
      .useValue({ notifyEmployee: vi.fn() })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const login = (ip: string) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'attaquant@exemple.fr', password: 'essai-au-hasard' });

  describe('en-têtes helmet', () => {
    it('ajoute les en-têtes de sécurité et masque la technologie du serveur', async () => {
      prisma.reparations.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).get('/api/reparations/track/QR-00000').set('X-Forwarded-For', '10.0.0.1');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['strict-transport-security']).toContain('max-age=');
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers).not.toHaveProperty('x-powered-by');
    });
  });

  describe('POST /auth/login : anti force brute', () => {
    beforeEach(() => {
      prisma.users.findFirst.mockResolvedValue(null); // compte inconnu → 401
    });

    it(`accepte ${LOGIN_LIMIT} tentatives par minute, puis répond 429 avec Retry-After`, async () => {
      const ip = '10.0.1.1';
      for (let i = 0; i < LOGIN_LIMIT; i++) {
        await login(ip).expect(401);
      }

      const blocked = await login(ip).expect(429);
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      // Une fois bloquée, la requête n'atteint même plus la vérification du mot de passe.
      expect(prisma.users.findFirst).toHaveBeenCalledTimes(LOGIN_LIMIT);
    });

    it("le blocage d'une adresse IP ne touche pas les autres utilisateurs", async () => {
      const attacker = '10.0.2.1';
      for (let i = 0; i <= LOGIN_LIMIT; i++) await login(attacker);
      await login(attacker).expect(429);

      await login('10.0.2.2').expect(401);
    });

    it('indique la limite restante dans les en-têtes de réponse', async () => {
      const res = await login('10.0.3.1').expect(401);

      expect(Number(res.headers['x-ratelimit-limit'])).toBe(LOGIN_LIMIT);
      expect(Number(res.headers['x-ratelimit-remaining'])).toBe(LOGIN_LIMIT - 1);
    });
  });

  describe('GET /reparations/track/:numero : anti énumération', () => {
    it(`accepte ${TRACK_LIMIT} recherches par minute, puis répond 429`, async () => {
      prisma.reparations.findFirst.mockResolvedValue(null);
      const ip = '10.0.4.1';
      const track = (n: number) =>
        request(app.getHttpServer()).get(`/api/reparations/track/QR-${10000 + n}`).set('X-Forwarded-For', ip);

      for (let i = 0; i < TRACK_LIMIT; i++) {
        await track(i).expect(404);
      }
      await track(TRACK_LIMIT).expect(429);
    });
  });
});
