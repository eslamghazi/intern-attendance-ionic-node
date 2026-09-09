import type { JwtClaims } from '../../../db/context.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { appSettings } from '../../../db/schema/index.js';
import type { BrandingResponseDto, SettingsResponseDto, UpdateSettingsDto } from '../dto/settings.dto.js';

export interface ISettingsService {
  getSettings(claims: JwtClaims | null): Promise<SettingsResponseDto | null>;
  getBranding(): Promise<BrandingResponseDto | null>;
  updateSettings(claims: JwtClaims, dto: UpdateSettingsDto): Promise<{ ok: true }>;
}

export interface ISettingsRepository extends IGenericRepository<
  typeof appSettings.$inferSelect,
  number,
  typeof appSettings.$inferInsert,
  Partial<typeof appSettings.$inferInsert>
> {
  getSettings(): Promise<typeof appSettings.$inferSelect | null>;
  getBranding(): Promise<any>;
  updateSettings(updateObj: Partial<typeof appSettings.$inferInsert>): Promise<void>;
}
