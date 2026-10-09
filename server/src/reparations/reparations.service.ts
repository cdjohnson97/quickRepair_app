import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtPayload } from '../auth/jwt.strategy.js';
import { CreateReparationDto } from './dto/create-reparation.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { ReparationsGateway } from './reparations.gateway.js';
import { PushService } from '../notifications/push.service.js';

const REPARATION_SELECT = {
  id_reparation: true,
  numero_suivi: true,
  description_panne: true,
  date_prise_en_charge: true,
  id_statut_actuel: true,
  id_technicien: true,
  statuts: { select: { libelle: true } },
  appareils: { select: { marque: true, modele: true, clients: { select: { nom: true, prenom: true, email: true, telephone: true } } } },
  employes: { select: { prenom: true, nom: true } }
} as const;

// Port des lectures/écritures `reparations` de ManagerDashboard.jsx, TechDashboard.jsx et
// ClientTracking.jsx (web) — mêmes colonnes, même logique métier (statuts 6/8 = clôturé).
@Injectable()
export class ReparationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: ReparationsGateway,
    private push: PushService
  ) {}

  async findAll(user: JwtPayload) {
    let where: { id_technicien: number } | { id_technicien: { in: number[] } };

    if (user.role === 'Technicien') {
      where = { id_technicien: user.sub };
    } else {
      // reparations.id_boutique n'est pas fiable : les tickets créés avant ce backend
      // ne l'ont jamais renseigné (NULL). Port fidèle de ManagerDashboard.fetchDashboardData
      // (web) : on filtre par la liste des techniciens de la boutique du manager, pas par
      // la colonne id_boutique elle-même.
      const techniciens = await this.prisma.employes.findMany({
        where: { role: 'Technicien', id_boutique: user.id_boutique ?? -1 },
        select: { id_employe: true }
      });
      where = { id_technicien: { in: techniciens.map((t) => t.id_employe) } };
    }

    return this.prisma.reparations.findMany({
      where,
      select: REPARATION_SELECT,
      orderBy: { date_prise_en_charge: 'desc' }
    });
  }

  async findHistory(idReparation: number) {
    return this.prisma.historique_statuts.findMany({
      where: { id_reparation: idReparation },
      select: {
        id_historique: true,
        date_changement: true,
        id_statut: true,
        commentaire: true,
        statuts: { select: { libelle: true } },
        employes: { select: { prenom: true, nom: true } }
      },
      orderBy: { date_changement: 'desc' }
    });
  }

  async trackByNumero(numeroSuivi: string) {
    const repair = await this.prisma.reparations.findFirst({
      where: { numero_suivi: { equals: numeroSuivi.trim(), mode: 'insensitive' } },
      select: {
        id_reparation: true,
        numero_suivi: true,
        id_statut_actuel: true,
        statuts: { select: { libelle: true } },
        appareils: { select: { marque: true, modele: true, clients: { select: { nom: true, prenom: true } } } },
        factures: { select: { numero_facture: true, montant_total: true, mode_paiement: true, date_emission: true } }
      }
    });
    if (!repair) throw new NotFoundException('Aucune réparation trouvée pour ce numéro de suivi.');

    const historique = await this.prisma.historique_statuts.findMany({
      where: { id_reparation: repair.id_reparation },
      select: {
        id_historique: true,
        id_statut: true,
        date_changement: true,
        commentaire: true,
        statuts: { select: { libelle: true } }
      },
      orderBy: { date_changement: 'desc' }
    });

    return { ...repair, historique_statuts: historique };
  }

  async create(dto: CreateReparationDto, idBoutique: number) {
    // Même convention que ManagerDashboard.jsx (web) : "QR-" + 5 chiffres.
    const numeroSuivi = `QR-${Math.floor(Math.random() * 90000 + 10000)}`;

    const repair = await this.prisma.$transaction(async (tx) => {
      const client = await tx.clients.upsert({
        where: { email: dto.clientEmail },
        update: { nom: dto.clientNom, prenom: dto.clientPrenom, telephone: dto.clientTelephone },
        create: {
          nom: dto.clientNom,
          prenom: dto.clientPrenom,
          email: dto.clientEmail,
          telephone: dto.clientTelephone
        }
      });

      const appareil = await tx.appareils.create({
        data: { marque: dto.marque, modele: dto.modele, id_client: client.id_client }
      });

      return tx.reparations.create({
        data: {
          numero_suivi: numeroSuivi,
          description_panne: dto.descriptionPanne,
          id_statut_actuel: 1,
          id_appareil: appareil.id_appareil,
          id_technicien: dto.idTechnicien,
          id_boutique: idBoutique
        },
        select: REPARATION_SELECT
      });
    });

    this.gateway.notifyRepairAssigned(dto.idTechnicien, repair);
    // Push mobile envoyé par le serveur (non attendu : n'échoue jamais et ne ralentit pas la réponse).
    void this.push.notifyEmployee(dto.idTechnicien, 'Nouveau ticket assigné 🛠️', `Ticket ${repair.numero_suivi} vous a été assigné.`, {
      type: 'repair',
      repairId: repair.id_reparation
    });
    return repair;
  }

  async updateStatus(idReparation: number, dto: UpdateStatusDto, user: JwtPayload) {
    const repair = await this.prisma.reparations.findUnique({ where: { id_reparation: idReparation } });
    if (!repair) throw new NotFoundException('Réparation introuvable.');
    if (user.role === 'Technicien' && repair.id_technicien !== user.sub) {
      throw new ForbiddenException("Cette réparation ne vous est pas assignée.");
    }

    // Un trigger Postgres insère déjà une ligne historique_statuts à chaque changement
    // de id_statut_actuel (avec un commentaire par défaut) — port fidèle de
    // TechDashboard.handleUpdateStatusAndComment (web) : on ne ré-insère rien, on met
    // seulement à jour le commentaire de la ligne que le trigger vient de créer.
    const updated = await this.prisma.reparations.update({
      where: { id_reparation: idReparation },
      data: { id_statut_actuel: dto.idStatut },
      select: REPARATION_SELECT
    });

    if (dto.commentaire?.trim()) {
      const latestHistory = await this.prisma.historique_statuts.findFirst({
        where: { id_reparation: idReparation },
        orderBy: { date_changement: 'desc' },
        select: { id_historique: true }
      });
      if (latestHistory) {
        await this.prisma.historique_statuts.update({
          where: { id_historique: latestHistory.id_historique },
          data: { commentaire: dto.commentaire }
        });
      }
    }

    return updated;
  }

  async createInvoice(idReparation: number, dto: CreateInvoiceDto) {
    const repair = await this.prisma.reparations.findUnique({ where: { id_reparation: idReparation } });
    if (!repair) throw new NotFoundException('Réparation introuvable.');

    const numeroFacture = `FAC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [facture] = await this.prisma.$transaction([
      this.prisma.factures.create({
        data: {
          numero_facture: numeroFacture,
          id_reparation: idReparation,
          montant_total: dto.montantTotal,
          mode_paiement: dto.modePaiement
        }
      }),
      this.prisma.reparations.update({ where: { id_reparation: idReparation }, data: { id_statut_actuel: 8 } })
    ]);

    return facture;
  }
}
