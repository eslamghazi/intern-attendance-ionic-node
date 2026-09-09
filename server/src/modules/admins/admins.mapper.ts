import { AdminDto, AdminAssignmentResponseDto } from './dto/admin.dto.js';

export class AdminsMapper {
  static toDto(row: any): AdminDto {
    return new AdminDto({
      id: row.id,
      full_name: row.fullName ?? row.full_name,
      national_id: row.nationalId ?? row.national_id,
      phone: row.phone ?? null,
      role: row.role,
      permissions: row.permissions ?? null,
    });
  }

  static toList(rows: any[]): AdminDto[] {
    return rows.map((r) => this.toDto(r));
  }

  static toAssignmentDto(row: any): AdminAssignmentResponseDto {
    return {
      id: row.id,
      admin_id: row.adminId ?? row.admin_id,
      group_id: row.groupId ?? row.group_id ?? null,
      branch_id: row.branchId ?? row.branch_id ?? null,
    };
  }

  static toAssignmentList(rows: any[]): AdminAssignmentResponseDto[] {
    return rows.map((r) => this.toAssignmentDto(r));
  }
}
