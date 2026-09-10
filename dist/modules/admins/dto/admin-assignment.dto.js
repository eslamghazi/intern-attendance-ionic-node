import { z } from 'zod';
export class AdminAssignmentDto {
    id;
    admin_id;
    group_id;
    branch_id;
    group;
    branch;
    constructor(data) {
        this.id = data.id;
        this.admin_id = data.admin_id;
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
//# sourceMappingURL=admin-assignment.dto.js.map