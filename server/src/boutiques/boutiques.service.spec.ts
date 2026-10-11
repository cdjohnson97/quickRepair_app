import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BOUTIQUE_PUBLIC_FIELDS, BoutiquesService } from './boutiques.service.js';
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

  describe('findPublic', () => {
    it('ne sélectionne que les colonnes publiques, triées par ville puis nom', async () => {
      prisma.boutiques.findMany.mockResolvedValue([]);

      await service.findPublic();

      expect(prisma.boutiques.findMany).toHaveBeenCalledWith({
        select: BOUTIQUE_PUBLIC_FIELDS,
        orderBy: [{ ville: 'asc' }, { nom: 'asc' }]
      });
    });

    it('n\'expose aucune relation (employés, réparations, stock)', () => {
      for (const relation of ['employes', 'reparations', 'stock_boutique']) {
        expect(BOUTIQUE_PUBLIC_FIELDS).not.toHaveProperty(relation);
      }
    });

    it('convertit les coordonnées Decimal en nombres', async () => {
      prisma.boutiques.findMany.mockResolvedValue([
        { id_boutique: 1, nom: 'Lyon', latitude: new Prisma.Decimal('45.76400000'), longitude: null }
      ]);

      const [boutique] = await service.findPublic();

      expect(boutique.latitude).toBe(45.764);
      expect(boutique.longitude).toBeNull();
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

  describe('update', () => {
    it('lève NotFoundException pour une boutique inexistante, sans rien modifier', async () => {
      prisma.boutiques.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { telephone: '0100000000' })).rejects.toThrow(
        new NotFoundException('Boutique introuvable.')
      );
      expect(prisma.boutiques.update).not.toHaveBeenCalled();
    });

    it('met à jour uniquement les champs envoyés (null vide un champ)', async () => {
      const dto = { telephone: '01 23 45 67 89', email_contact: null };
      prisma.boutiques.findUnique.mockResolvedValue({ id_boutique: 3, nom: 'Lyon' });
      prisma.boutiques.update.mockResolvedValue({
        id_boutique: 3,
        nom: 'Lyon',
        ...dto,
        latitude: new Prisma.Decimal('45.76400000'),
        longitude: null
      });

      const result = await service.update(3, dto);

      expect(prisma.boutiques.update).toHaveBeenCalledWith({ where: { id_boutique: 3 }, data: dto });
      expect(result).toMatchObject({ telephone: '01 23 45 67 89', email_contact: null, latitude: 45.764 });
    });
  });
});
