import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Rôles tels que stockés dans employes.role (web/mobile utilisent les mêmes chaînes).
export type Role = 'Administrateur' | 'Responsable' | 'Technicien';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
