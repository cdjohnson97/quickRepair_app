import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBoutiqueDto } from './dto/create-boutique.dto.js';
import { UpdateBoutiqueDto } from './dto/update-boutique.dto.js';

// Colonnes affichées sur la page d'accueil publique : coordonnées de contact et position
// sur la carte. Les relations (employés, réparations, stock) ne sont jamais renvoyées.
export const BOUTIQUE_PUBLIC_FIELDS = {
  id_boutique: true,
  nom: true,
  adresse: true,
  ville: true,
  telephone: true,
  email_contact: true,
  latitude: true,
  longitude: true
} as const;

// Port de fetchBoutiques / handleAddBoutique (AdminDashboard.jsx web) — mêmes colonnes.
@Injectable()
export class BoutiquesService {
  constructor(private prisma: PrismaService) {}

  // latitude/longitude sont des colonnes Decimal : Prisma les sérialise en chaînes de
  // caractères en JSON (contrairement à l'API REST de Supabase, qui renvoyait des
  // nombres). Leaflet (react-leaflet, web) attend des nombres pour positionner les
  // marqueurs — on convertit donc explicitement avant de renvoyer la réponse.
  private toNumberCoords<T extends { latitude: unknown; longitude: unknown }>(boutique: T) {
    return {
      ...boutique,
      latitude: boutique.latitude != null ? Number(boutique.latitude) : null,
      longitude: boutique.longitude != null ? Number(boutique.longitude) : null
    };
  }

  async findAll() {
    const boutiques = await this.prisma.boutiques.findMany({ orderBy: { id_boutique: 'asc' } });
    return boutiques.map((b) => this.toNumberCoords(b));
  }

  async findPublic() {
    const boutiques = await this.prisma.boutiques.findMany({
      select: BOUTIQUE_PUBLIC_FIELDS,
      orderBy: [{ ville: 'asc' }, { nom: 'asc' }]
    });
    return boutiques.map((b) => this.toNumberCoords(b));
  }

  async create(dto: CreateBoutiqueDto) {
    const boutique = await this.prisma.boutiques.create({ data: dto });
    return this.toNumberCoords(boutique);
  }

  async update(idBoutique: number, dto: UpdateBoutiqueDto) {
    const existing = await this.prisma.boutiques.findUnique({ where: { id_boutique: idBoutique } });
    if (!existing) throw new NotFoundException('Boutique introuvable.');

    const boutique = await this.prisma.boutiques.update({ where: { id_boutique: idBoutique }, data: dto });
    return this.toNumberCoords(boutique);
  }
}
