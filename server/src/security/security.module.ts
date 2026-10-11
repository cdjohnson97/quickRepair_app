import { ExecutionContext, Injectable, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// Limite par défaut, par adresse IP, pour toutes les routes HTTP. Les routes sensibles
// (connexion, suivi public) ont des limites plus strictes, voir RATE_LIMITS.
export const DEFAULT_RATE_LIMIT = { ttl: 60_000, limit: 100 };

export const RATE_LIMITS = {
  // Anti force brute : 5 tentatives de connexion par minute et par IP, puis blocage 5 minutes.
  login: { default: { ttl: 60_000, limit: 5, blockDuration: 5 * 60_000 } },
  // Anti énumération des numéros de suivi (route publique, sans compte).
  track: { default: { ttl: 60_000, limit: 20 } }
};

// La limitation ne concerne que HTTP : la passerelle Socket.IO (déjà authentifiée par JWT)
// n'a pas de requête Express à suivre.
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return context.getType() !== 'http';
  }
}

// Compteurs en mémoire : suffisant pour une seule instance de l'API. Avec plusieurs instances,
// il faudrait un stockage partagé (Redis).
@Module({
  imports: [ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ...DEFAULT_RATE_LIMIT }] })],
  providers: [{ provide: APP_GUARD, useClass: HttpThrottlerGuard }]
})
export class SecurityModule {}
