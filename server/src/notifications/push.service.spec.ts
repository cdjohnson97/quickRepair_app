import { PushService } from './push.service.js';
import { createPrismaMock, PrismaMock } from '../../test/helpers/prisma-mock.js';

describe('PushService', () => {
  let prisma: PrismaMock;
  let service: PushService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PushService(prisma);
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("n'appelle pas Expo quand l'employé n'a pas de jeton push", async () => {
    prisma.employes.findUnique.mockResolvedValue({ push_token: null });

    await expect(service.notifyEmployee(7, 'Titre', 'Corps')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envoie la notification au jeton de l'employé", async () => {
    prisma.employes.findUnique.mockResolvedValue({ push_token: 'ExponentPushToken[abc]' });

    await expect(service.notifyEmployee(7, 'Nouveau ticket', 'Ticket QR-12345', { repairId: 42 })).resolves.toBe(true);

    expect(prisma.employes.findUnique).toHaveBeenCalledWith({ where: { id_employe: 7 }, select: { push_token: true } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(JSON.parse(init.body)).toEqual({
      to: 'ExponentPushToken[abc]',
      sound: 'default',
      title: 'Nouveau ticket',
      body: 'Ticket QR-12345',
      data: { repairId: 42 }
    });
  });

  it('renvoie false sans lever d’erreur si Expo répond en erreur', async () => {
    prisma.employes.findUnique.mockResolvedValue({ push_token: 'ExponentPushToken[abc]' });
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(service.notifyEmployee(7, 'T', 'C')).resolves.toBe(false);
  });

  it('renvoie false sans lever d’erreur si le réseau échoue', async () => {
    prisma.employes.findUnique.mockResolvedValue({ push_token: 'ExponentPushToken[abc]' });
    fetchMock.mockRejectedValue(new Error('réseau indisponible'));

    await expect(service.notifyEmployee(7, 'T', 'C')).resolves.toBe(false);
  });
});
