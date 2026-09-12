import { z } from 'zod';

export class AdminAssignmentDto {
  id: string;
  admin_id: string;
  group_id: string | null;
  branch_id: string | null;
  group: { name: string } | null;
  branch: { name: string } | null;

  constructor(data: Partial<AdminAssignmentDto>) {
    this.id = data.id!;
    this.admin_id = data.admin_id!;
    this.group_id = data.group_id ?? null;
    this.branch_id = data.branch_id ?? null;
    this.group = data.group ?? null;
    this.branch = data.branch ?? null;
  }
}

export const createAdminAssignmentSchema = z.object({
  admin_id: z.string().uuid(),
  group_id: z.string().uuid().nullish(),
  branch_id: z.string().uuid().nullish(),
});

export type CreateAdminAssignmentDto = z.infer<typeof createAdminAssignmentSchema>;
