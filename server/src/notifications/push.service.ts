import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Envoie les notifications push Expo depuis le serveur. Depuis un navigateur, l'appel à
// exp.host est bloqué par CORS : le front web ne peut donc pas notifier l'application mobile.
// Ne lève jamais d'erreur : une notification ratée ne doit pas faire échouer l'action métier.
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private prisma: PrismaService) {}

  async notifyEmployee(idEmploye: number, title: string, body: string, data: Record<string, unknown> = {}): Promise<boolean> {
    try {
      const employe = await this.prisma.employes.findUnique({
        where: { id_employe: idEmploye },
        select: { push_token: true }
      });
      if (!employe?.push_token) return false;

      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: employe.push_token, sound: 'default', title, body, data })
      });
      if (!res.ok) {
        this.logger.warn(`Push refusé par Expo (HTTP ${res.status}) pour l'employé ${idEmploye}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Push impossible pour l'employé ${idEmploye} : ${(error as Error).message}`);
      return false;
    }
  }
}
