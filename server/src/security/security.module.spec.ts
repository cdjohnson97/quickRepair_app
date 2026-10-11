import { ExecutionContext } from '@nestjs/common';
import { HttpThrottlerGuard, RATE_LIMITS } from './security.module.js';

const contextOfType = (type: string) => ({ getType: () => type }) as unknown as ExecutionContext;

// shouldSkip est protégé : on l'appelle directement, sans dépendre du stockage du throttler.
const shouldSkip = (context: ExecutionContext) =>
  (HttpThrottlerGuard.prototype as unknown as { shouldSkip(c: ExecutionContext): Promise<boolean> }).shouldSkip(context);

describe('HttpThrottlerGuard', () => {
  it('limite les requêtes HTTP', async () => {
    await expect(shouldSkip(contextOfType('http'))).resolves.toBe(false);
  });

  it('ignore la passerelle Socket.IO (déjà authentifiée par JWT)', async () => {
    await expect(shouldSkip(contextOfType('ws'))).resolves.toBe(true);
  });
});

describe('RATE_LIMITS', () => {
  it('la connexion est bien plus stricte que la recherche publique, avec un blocage temporaire', () => {
    expect(RATE_LIMITS.login.default.limit).toBeLessThan(RATE_LIMITS.track.default.limit);
    expect(RATE_LIMITS.login.default.blockDuration).toBeGreaterThan(RATE_LIMITS.login.default.ttl);
  });
});
