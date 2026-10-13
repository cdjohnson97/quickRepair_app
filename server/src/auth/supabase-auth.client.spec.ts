import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseAuthClient } from './supabase-auth.client.js';

const USER_ID = '00000000-0000-4000-8000-000000000007';

// Jeton au format JWT (en-tête.payload.signature) : seule la partie payload est lue par le
// client, la signature étant vérifiée par Supabase Auth (simulé ici).
function fakeJwt(payload: object): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'ES256' })}.${part(payload)}.signature`;
}

describe('SupabaseAuthClient', () => {
  let client: SupabaseAuthClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = new SupabaseAuthClient(
      new ConfigService({ SUPABASE_URL: 'https://projet.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'cle-publique' })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const userResponse = (body: object, status = 200) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('interroge Supabase Auth avec la clé publique et le jeton de session', async () => {
    const token = fakeJwt({ sub: USER_ID, aal: 'aal2' });
    userResponse({ id: USER_ID });

    await client.verifySession(token);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://projet.supabase.co/auth/v1/user');
    expect(init.headers).toEqual({ apikey: 'cle-publique', Authorization: `Bearer ${token}` });
  });

  it('renvoie aal2 pour une session validée par mot de passe + code', async () => {
    userResponse({ id: USER_ID });

    await expect(client.verifySession(fakeJwt({ sub: USER_ID, aal: 'aal2' }))).resolves.toEqual({
      userId: USER_ID,
      aal: 'aal2'
    });
  });

  it('renvoie aal1 pour une session au mot de passe seul (ou sans niveau)', async () => {
    userResponse({ id: USER_ID });
    await expect(client.verifySession(fakeJwt({ sub: USER_ID, aal: 'aal1' }))).resolves.toMatchObject({ aal: 'aal1' });

    userResponse({ id: USER_ID });
    await expect(client.verifySession(fakeJwt({ sub: USER_ID }))).resolves.toMatchObject({ aal: 'aal1' });
  });

  it('renvoie null quand Supabase refuse le jeton (signature, expiration, déconnexion)', async () => {
    userResponse({ message: 'invalid JWT' }, 401);

    await expect(client.verifySession(fakeJwt({ sub: USER_ID, aal: 'aal2' }))).resolves.toBeNull();
  });

  it("renvoie null si le jeton ne correspond pas à l'utilisateur renvoyé par Supabase", async () => {
    userResponse({ id: 'un-autre-utilisateur' });

    await expect(client.verifySession(fakeJwt({ sub: USER_ID, aal: 'aal2' }))).resolves.toBeNull();
  });

  it('renvoie null pour un jeton illisible', async () => {
    userResponse({ id: USER_ID });

    await expect(client.verifySession('pas-un-jwt')).resolves.toBeNull();
  });

  it('lève une 503 quand Supabase Auth est injoignable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(client.verifySession(fakeJwt({ sub: USER_ID, aal: 'aal2' }))).rejects.toThrow(
      ServiceUnavailableException
    );
  });
});
