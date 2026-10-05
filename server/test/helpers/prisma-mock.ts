import { vi } from 'vitest';

// Faux PrismaService : aucune connexion réelle (le .env du serveur pointe vers la vraie
// base Supabase, les tests ne doivent jamais y toucher).
export function createPrismaMock() {
  const prisma: any = {
    users: { findFirst: vi.fn() },
    employes: { findUnique: vi.fn(), findMany: vi.fn() },
    clients: { upsert: vi.fn() },
    appareils: { create: vi.fn() },
    reparations: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    historique_statuts: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    factures: { create: vi.fn() },
    boutiques: { findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn()
  };

  // Forme callback : la callback reçoit le mock lui-même comme client transactionnel.
  // Forme tableau : les opérations sont déjà lancées, on attend leurs résultats.
  prisma.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function' ? arg(prisma) : Promise.all(arg as Promise<unknown>[])
  );

  return prisma;
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;
