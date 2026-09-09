import { z } from 'zod';
import { MAX_PAGE_SIZE } from '../../domain/member/filter.js';

const bool = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

export const filterQuery = z.object({
  branchId: z.string().uuid().nullish(),
  search: z.string().default(''),
  field: z.enum(['name', 'national_id', 'code']).default('name'),
  bypass_face: bool.optional(),
  bypass_location: bool.optional(),
  frozen: bool.optional(),
  has_face: bool.optional(),
  is_active: bool.optional(),
  departmentId: z.string().uuid().nullish(),
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
});

export const updateSchema = z.object({
  profile_id: z.string().uuid(),
  full_name: z.string().trim().min(1),
  national_id: z.string().trim().min(1),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  avatar_url: z.string().nullish(),
  group_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  bypass_face: z.boolean().optional(),
  bypass_location: z.boolean().optional(),
  bypass_checkout_window: z.boolean().optional(),
  frozen_at: z.string().nullable().optional(),
  can_generate_qr: z.boolean().optional(),
  can_make_roster: z.boolean().optional(),
  can_reset_face: z.boolean().optional(),
});

export const memberInput = z.object({
  national_id: z.string().trim(),
  full_name: z.string().trim(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  group_id: z.string().uuid(),
  branch_id: z.string().uuid(),
});
