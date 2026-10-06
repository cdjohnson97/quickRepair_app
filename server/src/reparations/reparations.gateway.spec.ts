import { JwtService } from '@nestjs/jwt';
import { ReparationsGateway } from './reparations.gateway.js';

const SECRET = 'secret-de-test';

function fakeClient(token?: unknown) {
  return {
    handshake: { auth: token === undefined ? {} : { token } },
    join: vi.fn(),
    disconnect: vi.fn()
  } as any;
}

describe('ReparationsGateway', () => {
  let jwt: JwtService;
  let gateway: ReparationsGateway;
  let emit: ReturnType<typeof vi.fn>;
  let to: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Vrai JwtService : on teste la vraie vérification de signature et d'expiration.
    jwt = new JwtService({ secret: SECRET });
    gateway = new ReparationsGateway(jwt);
    emit = vi.fn();
    to = vi.fn().mockReturnValue({ emit });
    gateway.server = { to } as any;
  });

  describe('handleConnection', () => {
    const payload = { sub: 7, email: 'tech@fixeo.fr', role: 'Technicien', id_boutique: 3 };

    it('place un technicien authentifié dans sa room personnelle', async () => {
      const client = fakeClient(await jwt.signAsync(payload));

      gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('technicien:7');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it("déconnecte un client sans token", () => {
      const client = fakeClient();

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('déconnecte un client dont le token est vide', () => {
      const client = fakeClient('');

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it("déconnecte un token qui n'est pas un JWT", () => {
      const client = fakeClient('pas-un-jwt');

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('déconnecte un token signé avec une autre clé', async () => {
      const forged = await new JwtService({ secret: 'autre-secret' }).signAsync(payload);
      const client = fakeClient(forged);

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('déconnecte un token expiré', async () => {
      const expired = await jwt.signAsync(payload, { expiresIn: -60 });
      const client = fakeClient(expired);

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handlePing', () => {
    it('répond pong', () => {
      expect(gateway.handlePing()).toEqual({ event: 'pong' });
    });
  });

  describe('notifyRepairAssigned', () => {
    it("émet repair:assigned uniquement vers la room du technicien concerné", () => {
      const repair = { id_reparation: 42, numero_suivi: 'QR-12345' };

      gateway.notifyRepairAssigned(7, repair);

      expect(to).toHaveBeenCalledTimes(1);
      expect(to).toHaveBeenCalledWith('technicien:7');
      expect(emit).toHaveBeenCalledWith('repair:assigned', repair);
    });
  });
});
