import { SetMetadata } from '@nestjs/common';
import type { AppRole } from '../auth/jwt.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
