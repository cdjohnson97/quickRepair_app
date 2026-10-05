import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBoutiqueDto } from './dto/create-boutique.dto.js';

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

  async create(dto: CreateBoutiqueDto) {
    const boutique = await this.prisma.boutiques.create({ data: dto });
    return this.toNumberCoords(boutique);
  }
}
