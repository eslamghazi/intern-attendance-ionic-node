import { z } from 'zod';
export const putMemberDepartmentSchema = z.object({
    member_id: z.string().uuid(),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    department_id: z.string().uuid().nullable(),
});
//# sourceMappingURL=member-department.dto.js.map