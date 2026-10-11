import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

// Configuration HTTP commune à main.ts et aux tests e2e : les tests vérifient ainsi exactement
// ce qui tourne en production (en-têtes de sécurité, préfixe, validation).
export function configureApp(app: NestExpressApplication) {
  // En production, Render place un proxy devant l'API : sans cela, toutes les requêtes
  // sembleraient venir de l'IP du proxy et la limitation de débit bloquerait tout le monde.
  app.set('trust proxy', 1);

  // En-têtes HTTP de sécurité (OWASP) : X-Content-Type-Options, X-Frame-Options,
  // Strict-Transport-Security, Content-Security-Policy, suppression de X-Powered-By…
  app.use(helmet());

  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
