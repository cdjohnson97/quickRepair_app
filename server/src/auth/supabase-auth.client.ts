import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Valeurs publiques du projet Supabase (déjà présentes dans le front) : surchargeables par
// SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY.
const DEFAULT_SUPABASE_URL = 'https://ueeytlrvxuobeszglkfk.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_mFJvqz9AoB-uZATp4NMjaA_JQSXg4R3';

export interface SupabaseSession {
  userId: string;
  // Niveau d'authentification : aal1 = mot de passe seul, aal2 = mot de passe + code 2FA.
  aal: 'aal1' | 'aal2';
}

// Valide un jeton de session Supabase (access token) auprès de Supabase Auth, qui vérifie
// signature, expiration et révocation (déconnexion). Le niveau d'authentification (aal) est
// ensuite lu dans le jeton, désormais validé.
@Injectable()
export class SupabaseAuthClient {
  private readonly logger = new Logger(SupabaseAuthClient.name);
  private readonly url: string;
  private readonly publishableKey: string;

  constructor(config: ConfigService) {
    this.url = config.get<string>('SUPABASE_URL', DEFAULT_SUPABASE_URL);
    this.publishableKey = config.get<string>('SUPABASE_PUBLISHABLE_KEY', DEFAULT_PUBLISHABLE_KEY);
  }

  async verifySession(accessToken: string): Promise<SupabaseSession | null> {
    let response: Response;
    try {
      response = await fetch(`${this.url}/auth/v1/user`, {
        headers: { apikey: this.publishableKey, Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5_000)
      });
    } catch (error) {
      this.logger.error(`Supabase Auth injoignable : ${(error as Error).message}`);
      throw new ServiceUnavailableException("Service d'authentification indisponible.");
    }
    if (!response.ok) return null;

    const user = (await response.json()) as { id?: string };
    const claims = decodePayload(accessToken);
    if (!user.id || claims?.sub !== user.id) return null;

    return { userId: user.id, aal: claims.aal === 'aal2' ? 'aal2' : 'aal1' };
  }
}

function decodePayload(jwt: string): { sub?: string; aal?: string } | null {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
