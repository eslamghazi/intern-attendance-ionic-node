import type { JwtClaims } from '../../../infrastructure/database/context.js';
import type { IGenericRepository } from '../../../infrastructure/database/interfaces/generic-repository.interface.js';
import { appSettings } from '../../../infrastructure/database/schema/index.js';
import type { BrandingResponseDto, SettingsResponseDto, UpdateSettingsDto } from '../dto/settings.dto.js';

export interface ISettingsService {
  getSettings(): Promise<SettingsResponseDto | null>;
  getBranding(): Promise<BrandingResponseDto | null>;
  updateSettings(dto: UpdateSettingsDto): Promise<{ ok: true }>;
}

export interface ISettingsRepository extends IGenericRepository<typeof appSettings, number> {
  /**
   * Partial, not the whole row: the implementation enumerates the columns it
   * reads so that master_password_hash is never selected. See
   * SettingsRepository.getSettings().
   */
  getSettings(): Promise<Omit<typeof appSettings.$inferSelect, 'masterPasswordHash'> | null>;
  getBranding(): Promise<BrandingResponseDto | null>;
  updateSettings(updateObj: Partial<typeof appSettings.$inferInsert>): Promise<void>;
}
