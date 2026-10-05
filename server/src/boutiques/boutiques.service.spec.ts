import { Prisma } from '@prisma/client';
import { BoutiquesService } from './boutiques.service.js';
import { createPrismaMock, PrismaMock } from '../../test/helpers/prisma-mock.js';

describe('BoutiquesService', () => {
  let prisma: PrismaMock;
  let service: BoutiquesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new BoutiquesService(prisma);
  });

  describe('findAll', () => {
    it('trie par id_boutique croissant', async () => {
      prisma.boutiques.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.boutiques.findMany).toHaveBeenCalledWith({ orderBy: { id_boutique: 'asc' } });
    });

    it('convertit les coordonnées Decimal en nombres (Leaflet attend des nombres)', async () => {
      prisma.boutiques.findMany.mockResolvedValue([
        {
          id_boutique: 1,
          nom: 'Lyon',
          latitude: new Prisma.Decimal('45.76400000'),
          longitude: new Prisma.Decimal('4.83570000')
        }
      ]);

      const [boutique] = await service.findAll();

      expect(boutique.latitude).toBe(45.764);
      expect(boutique.longitude).toBe(4.8357);
      expect(typeof boutique.latitude).toBe('number');
      // Sérialisé en JSON, il doit rester un nombre et non une chaîne.
      expect(JSON.parse(JSON.stringify(boutique)).latitude).toBe(45.764);
    });

    it('garde null quand une boutique n\'a pas de coordonnées', async () => {
      prisma.boutiques.findMany.mockResolvedValue([{ id_boutique: 2, nom: 'Sans GPS', latitude: null, longitude: null }]);

      const [boutique] = await service.findAll();

      expect(boutique.latitude).toBeNull();
      expect(boutique.longitude).toBeNull();
    });

    it('conserve les autres champs inchangés', async () => {
      prisma.boutiques.findMany.mockResolvedValue([
        { id_boutique: 1, nom: 'Lyon', ville: 'Lyon', adresse: '1 rue A', latitude: null, longitude: null }
      ]);

      const [boutique] = await service.findAll();

      expect(boutique).toMatchObject({ id_boutique: 1, nom: 'Lyon', ville: 'Lyon', adresse: '1 rue A' });
    });

    it('gère 0 comme une coordonnée valide (et non comme une absence)', async () => {
      prisma.boutiques.findMany.mockResolvedValue([
        { id_boutique: 3, nom: 'Équateur', latitude: new Prisma.Decimal(0), longitude: new Prisma.Decimal(0) }
      ]);

      const [boutique] = await service.findAll();

      expect(boutique.latitude).toBe(0);
      expect(boutique.longitude).toBe(0);
    });
  });

  describe('create', () => {
    it('transmet le DTO tel quel à Prisma et renvoie des coordonnées numériques', async () => {
      const dto = { nom: 'Paris', ville: 'Paris', adresse: '2 rue B', latitude: 48.8566, longitude: 2.3522 };
      prisma.boutiques.create.mockResolvedValue({
        id_boutique: 9,
        ...dto,
        latitude: new Prisma.Decimal('48.85660000'),
        longitude: new Prisma.Decimal('2.35220000')
      });

      const result = await service.create(dto);

      expect(prisma.boutiques.create).toHaveBeenCalledWith({ data: dto });
      expect(result.latitude).toBe(48.8566);
      expect(result.longitude).toBe(2.3522);
    });
  });
});
