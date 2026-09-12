var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
export class DepartmentDto {
    id;
    name;
    branch_id;
    branch_name;
    constructor(data) {
        if (data.id)
            this.id = data.id;
        if (data.name)
            this.name = data.name;
        this.branch_id = data.branch_id ?? null;
        this.branch_name = data.branch_name ?? null;
    }
}
__decorate([
    ApiProperty({ example: 'd1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' }),
    __metadata("design:type", String)
], DepartmentDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Pediatrics' }),
    __metadata("design:type", String)
], DepartmentDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    __metadata("design:type", Object)
], DepartmentDto.prototype, "branch_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Main Branch' }),
    __metadata("design:type", Object)
], DepartmentDto.prototype, "branch_name", void 0);
export class CreateDepartmentDto {
    name;
    /** The hospital this department belongs to. Required: there is no department without one. */
    branch_id;
}
__decorate([
    ApiProperty({ example: 'Pediatrics' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateDepartmentDto.prototype, "name", void 0);
__decorate([
    ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    IsUUID(),
    __metadata("design:type", String)
], CreateDepartmentDto.prototype, "branch_id", void 0);
export class UpdateDepartmentDto extends CreateDepartmentDto {
    id;
}
__decorate([
    ApiPropertyOptional({ example: 'd1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], UpdateDepartmentDto.prototype, "id", void 0);
export class PutMemberDepartmentDto {
    member_id;
    year;
    month;
    department_id;
}
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74555' }),
    IsUUID(),
    __metadata("design:type", String)
], PutMemberDepartmentDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ example: 2026 }),
    IsInt(),
    __metadata("design:type", Number)
], PutMemberDepartmentDto.prototype, "year", void 0);
__decorate([
    ApiProperty({ example: 9 }),
    IsInt(),
    Min(1),
    Max(12),
    __metadata("design:type", Number)
], PutMemberDepartmentDto.prototype, "month", void 0);
__decorate([
    ApiPropertyOptional({ example: 'd1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", Object)
], PutMemberDepartmentDto.prototype, "department_id", void 0);
//# sourceMappingURL=department.dto.js.map