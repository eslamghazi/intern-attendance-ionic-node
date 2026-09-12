import { DepartmentDto } from './dto/department.dto.js';
export class DepartmentsMapper {
    static toDto(entity) {
        return new DepartmentDto({
            id: entity.id,
            name: entity.name,
            branch_id: entity.branch_id ?? entity.branchId,
            branch_name: entity.branch_name ?? entity.branchName,
        });
    }
}
//# sourceMappingURL=departments.mapper.js.map