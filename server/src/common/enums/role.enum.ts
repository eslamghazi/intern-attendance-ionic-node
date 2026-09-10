export enum Role {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  MEMBER = 'member',
}

export const ROLES = [Role.SUPERADMIN, Role.ADMIN, Role.MEMBER] as const;

export const STAFF_ROLES: readonly Role[] = [Role.SUPERADMIN, Role.ADMIN];
