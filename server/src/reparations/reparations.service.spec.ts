import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReparationsService } from './reparations.service.js';
import { JwtPayload } from '../auth/jwt.strategy.js';
import { createPrismaMock, PrismaMock } from '../../test/helpers/prisma-mock.js';

const technicien = (sub = 7, id_boutique: number | null = 3): JwtPayload => ({
  sub,
  email: `tech${sub}@quickrepair.fr`,
  role: 'Technicien',
  id_boutique
});

const responsable = (id_boutique: number | null = 3): JwtPayload => ({
  sub: 1,
  email: 'manager@quickrepair.fr',
  role: 'Responsable',
  id_boutique
});

describe('ReparationsService', () => {
  let prisma: PrismaMock;
  let gateway: { notifyRepairAssigned: ReturnType<typeof vi.fn> };
  let service: ReparationsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    gateway = { notifyRepairAssigned: vi.fn() };
    service = new ReparationsService(prisma, gateway as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findAll', () => {
    it("un technicien ne voit que les réparations qui lui sont assignées, les plus récentes d'abord", async () => {
      prisma.reparations.findMany.mockResolvedValue([]);

      await service.findAll(technicien(7));

      expect(prisma.employes.findMany).not.toHaveBeenCalled();
      const args = prisma.reparations.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ id_technicien: 7 });
      expect(args.orderBy).toEqual({ date_prise_en_charge: 'desc' });
    });

    it("un responsable voit les réparations des techniciens de sa boutique (pas la colonne id_boutique, souvent NULL)", async () => {
      prisma.employes.findMany.mockResolvedValue([{ id_employe: 10 }, { id_employe: 11 }]);
      prisma.reparations.findMany.mockResolvedValue([]);

      await service.findAll(responsable(3));

      expect(prisma.employes.findMany).toHaveBeenCalledWith({
        where: { role: 'Technicien', id_boutique: 3 },
        select: { id_employe: true }
      });
      expect(prisma.reparations.findMany.mock.calls[0][0].where).toEqual({ id_technicien: { in: [10, 11] } });
    });

    it("un responsable sans boutique ne voit aucune réparation (id_boutique -1 ne correspond à rien)", async () => {
      prisma.employes.findMany.mockResolvedValue([]);
      prisma.reparations.findMany.mockResolvedValue([]);

      await service.findAll(responsable(null));

      expect(prisma.employes.findMany.mock.calls[0][0].where.id_boutique).toBe(-1);
      expect(prisma.reparations.findMany.mock.calls[0][0].where).toEqual({ id_technicien: { in: [] } });
    });

    it('renvoie ce que Prisma retourne', async () => {
      const rows = [{ id_reparation: 1 }, { id_reparation: 2 }];
      prisma.reparations.findMany.mockResolvedValue(rows);

      await expect(service.findAll(technicien())).resolves.toBe(rows);
    });
  });

  describe('findHistory', () => {
    it("liste l'historique d'une réparation, du plus récent au plus ancien", async () => {
      prisma.historique_statuts.findMany.mockResolvedValue([]);

      await service.findHistory(42);

      const args = prisma.historique_statuts.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ id_reparation: 42 });
      expect(args.orderBy).toEqual({ date_changement: 'desc' });
    });
  });

  describe('trackByNumero', () => {
    const repair = {
      id_reparation: 42,
      numero_suivi: 'QR-12345',
      id_statut_actuel: 5,
      statuts: { libelle: 'En cours' },
      appareils: { marque: 'Apple', modele: 'iPhone 13', clients: { nom: 'Martin', prenom: 'Léa' } },
      factures: []
    };

    it("lève NotFoundException quand aucun numéro ne correspond", async () => {
      prisma.reparations.findFirst.mockResolvedValue(null);

      await expect(service.trackByNumero('QR-00000')).rejects.toThrow(
        new NotFoundException('Aucune réparation trouvée pour ce numéro de suivi.')
      );
      expect(prisma.historique_statuts.findMany).not.toHaveBeenCalled();
    });

    it('ignore la casse et les espaces autour du numéro saisi', async () => {
      prisma.reparations.findFirst.mockResolvedValue(repair);
      prisma.historique_statuts.findMany.mockResolvedValue([]);

      await service.trackByNumero('  qr-12345 ');

      expect(prisma.reparations.findFirst.mock.calls[0][0].where).toEqual({
        numero_suivi: { equals: 'qr-12345', mode: 'insensitive' }
      });
    });

    it("joint l'historique de la réparation trouvée", async () => {
      const historique = [{ id_historique: 1, id_statut: 5 }];
      prisma.reparations.findFirst.mockResolvedValue(repair);
      prisma.historique_statuts.findMany.mockResolvedValue(historique);

      const result = await service.trackByNumero('QR-12345');

      expect(prisma.historique_statuts.findMany.mock.calls[0][0].where).toEqual({ id_reparation: 42 });
      expect(result).toEqual({ ...repair, historique_statuts: historique });
    });

    it("n'expose au public ni l'email ni le téléphone du client, ni le technicien", async () => {
      prisma.reparations.findFirst.mockResolvedValue(repair);
      prisma.historique_statuts.findMany.mockResolvedValue([]);

      await service.trackByNumero('QR-12345');

      const { select } = prisma.reparations.findFirst.mock.calls[0][0];
      expect(select.appareils.select.clients.select).toEqual({ nom: true, prenom: true });
      expect(select).not.toHaveProperty('employes');
      expect(select).not.toHaveProperty('id_technicien');
      const historiqueSelect = prisma.historique_statuts.findMany.mock.calls[0][0].select;
      expect(historiqueSelect).not.toHaveProperty('employes');
    });
  });

  describe('create', () => {
    const dto = {
      clientNom: 'Martin',
      clientPrenom: 'Léa',
      clientEmail: 'lea@mail.fr',
      clientTelephone: '0600000000',
      marque: 'Apple',
      modele: 'iPhone 13',
      descriptionPanne: 'Écran cassé',
      idTechnicien: 7
    };

    beforeEach(() => {
      prisma.clients.upsert.mockResolvedValue({ id_client: 20 });
      prisma.appareils.create.mockResolvedValue({ id_appareil: 30 });
      prisma.reparations.create.mockResolvedValue({ id_reparation: 42, numero_suivi: 'QR-12345' });
    });

    it('crée ou met à jour le client par email (upsert) sans dupliquer une fiche existante', async () => {
      await service.create(dto, 3);

      expect(prisma.clients.upsert).toHaveBeenCalledWith({
        where: { email: 'lea@mail.fr' },
        update: { nom: 'Martin', prenom: 'Léa', telephone: '0600000000' },
        create: { nom: 'Martin', prenom: 'Léa', email: 'lea@mail.fr', telephone: '0600000000' }
      });
    });

    it("rattache l'appareil au client puis la réparation à l'appareil, au technicien et à la boutique", async () => {
      await service.create(dto, 3);

      expect(prisma.appareils.create).toHaveBeenCalledWith({
        data: { marque: 'Apple', modele: 'iPhone 13', id_client: 20 }
      });
      const { data } = prisma.reparations.create.mock.calls[0][0];
      expect(data).toMatchObject({
        description_panne: 'Écran cassé',
        id_statut_actuel: 1,
        id_appareil: 30,
        id_technicien: 7,
        id_boutique: 3
      });
    });

    it('exécute les trois écritures dans une seule transaction', async () => {
      await service.create(dto, 3);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(typeof prisma.$transaction.mock.calls[0][0]).toBe('function');
    });

    it('génère un numéro de suivi au format QR- suivi de 5 chiffres', async () => {
      await service.create(dto, 3);

      const { data } = prisma.reparations.create.mock.calls[0][0];
      expect(data.numero_suivi).toMatch(/^QR-\d{5}$/);
    });

    it('le numéro de suivi reste sur 5 chiffres aux bornes du tirage aléatoire', async () => {
      const random = vi.spyOn(Math, 'random');

      random.mockReturnValue(0);
      await service.create(dto, 3);
      random.mockReturnValue(0.999999);
      await service.create(dto, 3);

      const numeros = prisma.reparations.create.mock.calls.map((c: any[]) => c[0].data.numero_suivi);
      expect(numeros).toEqual(['QR-10000', 'QR-99999']);
    });

    it('notifie le technicien assigné, avec la réparation créée, une fois la transaction terminée', async () => {
      const created = { id_reparation: 42, numero_suivi: 'QR-12345' };
      prisma.reparations.create.mockResolvedValue(created);

      const result = await service.create(dto, 3);

      expect(gateway.notifyRepairAssigned).toHaveBeenCalledTimes(1);
      expect(gateway.notifyRepairAssigned).toHaveBeenCalledWith(7, created);
      expect(result).toBe(created);
    });

    it('ne notifie personne si la création échoue', async () => {
      prisma.reparations.create.mockRejectedValue(new Error('violation de contrainte'));

      await expect(service.create(dto, 3)).rejects.toThrow('violation de contrainte');
      expect(gateway.notifyRepairAssigned).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    const updated = { id_reparation: 42, id_statut_actuel: 5 };

    beforeEach(() => {
      prisma.reparations.update.mockResolvedValue(updated);
    });

    it('lève NotFoundException pour une réparation inexistante', async () => {
      prisma.reparations.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus(999, { idStatut: 5 }, technicien())).rejects.toThrow(
        new NotFoundException('Réparation introuvable.')
      );
      expect(prisma.reparations.update).not.toHaveBeenCalled();
    });

    it("interdit à un technicien de modifier une réparation assignée à un collègue", async () => {
      prisma.reparations.findUnique.mockResolvedValue({ id_reparation: 42, id_technicien: 8 });

      await expect(service.updateStatus(42, { idStatut: 5 }, technicien(7))).rejects.toThrow(ForbiddenException);
      expect(prisma.reparations.update).not.toHaveBeenCalled();
      expect(prisma.historique_statuts.update).not.toHaveBeenCalled();
    });

    it('permet au technicien assigné de changer le statut', async () => {
      prisma.reparations.findUnique.mockResolvedValue({ id_reparation: 42, id_technicien: 7 });

      const result = await service.updateStatus(42, { idStatut: 5 }, technicien(7));

      expect(prisma.reparations.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_reparation: 42 }, data: { id_statut_actuel: 5 } })
      );
      expect(result).toBe(updated);
    });

    it("permet à un responsable de changer le statut d'une réparation assignée à un technicien", async () => {
      prisma.reparations.findUnique.mockResolvedValue({ id_reparation: 42, id_technicien: 8 });

      await service.updateStatus(42, { idStatut: 6 }, responsable());

      expect(prisma.reparations.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { id_statut_actuel: 6 } })
      );
    });

    it("n'insère jamais de ligne d'historique : le trigger Postgres s'en charge", async () => {
      prisma.reparations.findUnique.mockResolvedValue({ id_reparation: 42, id_technicien: 7 });
      prisma.historique_statuts.findFirst.mockResolvedValue({ id_historique: 100 });

      await service.updateStatus(42, { idStatut: 5, commentaire: 'Pièce reçue' }, technicien(7));

      expect(prisma.historique_statuts.create).not.toHaveBeenCalled();
    });

    it("met à jour le commentaire de la ligne d'historique la plus récente", async () => {
      prisma.reparations.findUnique.mockResolvedValue({ id_reparation: 42, id_technicien: 7 });
      prisma.historique_statuts.findFirst.mockResolvedValue({ id_historique: 100 });

      await service.updateStatus(42, { idStatut: 5, commentaire: 'Pièce reçue' }, technicien(7));

      expect(prisma.historique_statuts.findFirst).toHaveBeenCalledWith({
        where: { id_reparation: 42 },
        orderBy: { date_changement: 'desc' },
        select: { id_historique: true }
      });
      expect(prisma.historique_statuts.update).toHaveBeenCalledWith({
        where: { id_historique: 100 },
        data: { commentaire: 'Pièce reçue' }
      });
    });

    it.each([
      ['sans commentaire', undefined],
      ['avec un commentaire vide', ''],
      ['avec un commentaire fait uniquement d\'espaces', '   ']
    ])("ne touche pas à l'historique %s", async (_label, commentaire) => {
      prisma.reparations.findUnique.mockResolvedValue({ id_reparation: 42, id_technicien: 7 });

      await service.updateStatus(42, { idStatut: 5, commentaire }, technicien(7));

      expect(prisma.historique_statuts.findFirst).not.toHaveBeenCalled();
      expect(prisma.historique_statuts.update).not.toHaveBeenCalled();
    });

    it("ne plante pas quand le trigger n'a créé aucune ligne d'historique", async () => {
      prisma.reparations.findUnique.mockResolvedValue({ id_reparation: 42, id_technicien: 7 });
      prisma.historique_statuts.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(42, { idStatut: 5, commentaire: 'Note' }, technicien(7))
      ).resolves.toBe(updated);
      expect(prisma.historique_statuts.update).not.toHaveBeenCalled();
    });

    // Lacunes d'autorisation constatées dans le code actuel : un responsable n'est pas
    // limité à sa boutique. À transformer en vrais tests quand la règle sera implémentée.
    it.todo("refuse à un responsable de modifier une réparation d'une autre boutique");
  });

  describe('createInvoice', () => {
    const dto = { montantTotal: 149.9, modePaiement: 'Carte bancaire' };

    beforeEach(() => {
      prisma.reparations.findUnique.mockResolvedValue({ id_reparation: 42 });
      prisma.factures.create.mockResolvedValue({ id_facture: 1, numero_facture: 'FAC-2026-1234' });
      prisma.reparations.update.mockResolvedValue({ id_reparation: 42, id_statut_actuel: 8 });
    });

    it('lève NotFoundException pour une réparation inexistante', async () => {
      prisma.reparations.findUnique.mockResolvedValue(null);

      await expect(service.createInvoice(999, dto)).rejects.toThrow(new NotFoundException('Réparation introuvable.'));
      expect(prisma.factures.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('crée la facture avec le montant, le mode de paiement et la réparation', async () => {
      await service.createInvoice(42, dto);

      expect(prisma.factures.create).toHaveBeenCalledWith({
        data: {
          numero_facture: expect.any(String),
          id_reparation: 42,
          montant_total: 149.9,
          mode_paiement: 'Carte bancaire'
        }
      });
    });

    it("génère un numéro FAC-<année en cours>-<4 chiffres>", async () => {
      await service.createInvoice(42, dto);

      const { numero_facture } = prisma.factures.create.mock.calls[0][0].data;
      expect(numero_facture).toMatch(new RegExp(`^FAC-${new Date().getFullYear()}-\\d{4}$`));
    });

    it('le numéro de facture reste sur 4 chiffres aux bornes du tirage aléatoire', async () => {
      const random = vi.spyOn(Math, 'random');

      random.mockReturnValue(0);
      await service.createInvoice(42, dto);
      random.mockReturnValue(0.999999);
      await service.createInvoice(42, dto);

      const numeros = prisma.factures.create.mock.calls.map((c: any[]) => c[0].data.numero_facture.split('-')[2]);
      expect(numeros).toEqual(['1000', '9999']);
    });

    it('passe la réparation au statut 8 (livrée) dans la même transaction que la facture', async () => {
      await service.createInvoice(42, dto);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(Array.isArray(prisma.$transaction.mock.calls[0][0])).toBe(true);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
      expect(prisma.reparations.update).toHaveBeenCalledWith({
        where: { id_reparation: 42 },
        data: { id_statut_actuel: 8 }
      });
    });

    it('renvoie la facture créée, pas la réparation', async () => {
      const result = await service.createInvoice(42, dto);

      expect(result).toEqual({ id_facture: 1, numero_facture: 'FAC-2026-1234' });
    });

    it('ne facture pas si la mise à jour du statut échoue', async () => {
      prisma.$transaction.mockRejectedValue(new Error('transaction annulée'));

      await expect(service.createInvoice(42, dto)).rejects.toThrow('transaction annulée');
    });

    it.todo("refuse de facturer une réparation d'une autre boutique");
    it.todo('refuse de créer une seconde facture pour une réparation déjà facturée');
  });
});
