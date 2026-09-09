import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { CatalogRepository } from './catalog.repository.js';
import type { JwtClaims } from '../../db/context.js';
import { notFound } from '../../http/errors.js';
import { CatalogMapper } from './catalog.mapper.js';
import type {
  CreateInstitutionDto,
  UpdateInstitutionDto,
  InstitutionResponseDto,
  CreateBranchDto,
  UpdateBranchDto,
  BranchResponseDto,
  BranchOptionResponseDto,
  CreateGroupDto,
  UpdateGroupDto,
  GroupResponseDto,
  GroupOptionResponseDto,
  CreateShiftDto,
  UpdateShiftDto,
  ShiftResponseDto,
  ShiftKeyOptionResponseDto,
} from './dto/catalog.dto.js';

@Injectable()
export class CatalogService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: CatalogRepository,
  ) {}

  /* Institutions */
  async getInstitutions(claims: JwtClaims): Promise<InstitutionResponseDto[]> {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getInstitutions();
      return CatalogMapper.toInstitutionList(rows);
    });
  }

  async createInstitution(claims: JwtClaims, data: CreateInstitutionDto): Promise<InstitutionResponseDto> {
    return this.uow.asCaller(claims, async () => {
      const row = await this.repo.insertInstitution(data.name, data.code ?? 0);
      return CatalogMapper.toInstitutionDto(row);
    });
  }

  async updateInstitution(claims: JwtClaims, id: string, data: UpdateInstitutionDto): Promise<InstitutionResponseDto> {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.updateInstitution(id, data.name, data.code ?? 0);
      if (!result) throw notFound();
      return CatalogMapper.toInstitutionDto(result);
    });
  }

  async deleteInstitution(claims: JwtClaims, id: string): Promise<void> {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.deleteInstitution(id);
      if (!result) throw notFound();
    });
  }

  /* Branches */
  async getBranches(claims: JwtClaims): Promise<BranchResponseDto[]> {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getBranches();
      return CatalogMapper.toBranchList(rows);
    });
  }

  async getBranchesOptions(claims: JwtClaims): Promise<BranchOptionResponseDto[]> {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getBranchesOptions();
      return CatalogMapper.toBranchOptionList(rows);
    });
  }

  async createBranch(claims: JwtClaims, b: CreateBranchDto): Promise<BranchResponseDto> {
    return this.uow.asCaller(claims, async () => {
      const row = await this.repo.insertBranch({
        name: b.name,
        address: b.address || null,
        latitude: b.latitude,
        longitude: b.longitude,
        radiusMeters: b.radius_meters,
        areaCoords: b.area_coords && b.area_coords.length >= 3 ? (b.area_coords as any) : null,
        institutionId: b.institution_id || null,
        bypassFace: b.bypass_face ?? false,
        bypassLocation: b.bypass_location ?? false,
        bypassCheckoutWindow: b.bypass_checkout_window ?? false,
        requireQr: b.require_qr ?? false,
        qrEnabled: b.require_qr ? true : (b.qr_enabled ?? true),
        blockCheckin: b.block_checkin ?? false,
      });
      return CatalogMapper.toBranchDto(row);
    });
  }

  async updateBranch(claims: JwtClaims, id: string, b: UpdateBranchDto): Promise<BranchResponseDto> {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.updateBranch(id, {
        name: b.name,
        address: b.address || null,
        latitude: b.latitude,
        longitude: b.longitude,
        radiusMeters: b.radius_meters,
        areaCoords: b.area_coords && b.area_coords.length >= 3 ? (b.area_coords as any) : null,
        institutionId: b.institution_id || null,
        bypassFace: b.bypass_face ?? false,
        bypassLocation: b.bypass_location ?? false,
        bypassCheckoutWindow: b.bypass_checkout_window ?? false,
        requireQr: b.require_qr ?? false,
        qrEnabled: b.require_qr ? true : (b.qr_enabled ?? true),
        blockCheckin: b.block_checkin ?? false,
      });
      if (!result) throw notFound();
      return CatalogMapper.toBranchDto(result);
    });
  }

  async deleteBranch(claims: JwtClaims, id: string): Promise<void> {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.deleteBranch(id);
      if (!result) throw notFound();
    });
  }

  /* Groups */
  async getGroups(claims: JwtClaims): Promise<GroupResponseDto[]> {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getGroups();
      return CatalogMapper.toGroupList(rows);
    });
  }

  async getGroupsOptions(claims: JwtClaims): Promise<GroupOptionResponseDto[]> {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getGroupsOptions();
      return CatalogMapper.toGroupOptionList(rows);
    });
  }

  async createGroup(claims: JwtClaims, g: CreateGroupDto): Promise<GroupResponseDto> {
    return this.uow.asCaller(claims, async () => {
      const row = await this.repo.insertGroup({
        name: g.name,
        year: g.year,
        institutionId: g.institution_id || null,
        branchId: g.branch_id || null,
        startDate: g.start_date || null,
        endDate: g.end_date || null,
        bypassFace: g.bypass_face ?? false,
        bypassLocation: g.bypass_location ?? false,
        bypassCheckoutWindow: g.bypass_checkout_window ?? false,
      });
      return CatalogMapper.toGroupDto(row);
    });
  }

  async updateGroup(claims: JwtClaims, id: string, g: UpdateGroupDto): Promise<GroupResponseDto> {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.updateGroup(id, {
        name: g.name,
        year: g.year,
        institutionId: g.institution_id || null,
        branchId: g.branch_id || null,
        startDate: g.start_date || null,
        endDate: g.end_date || null,
        bypassFace: g.bypass_face ?? false,
        bypassLocation: g.bypass_location ?? false,
        bypassCheckoutWindow: g.bypass_checkout_window ?? false,
      });
      if (!result) throw notFound();
      return CatalogMapper.toGroupDto(result);
    });
  }

  async deleteGroup(claims: JwtClaims, id: string): Promise<void> {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.deleteGroup(id);
      if (!result) throw notFound();
    });
  }

  /* Shifts */
  async getShifts(claims: JwtClaims): Promise<ShiftResponseDto[]> {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getShifts();
      return CatalogMapper.toShiftList(rows);
    });
  }

  async getShiftsKeys(claims: JwtClaims): Promise<ShiftKeyOptionResponseDto[]> {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getShiftsKeys();
      return rows.map((r) => ({ id: r.id, key: r.key ?? null }));
    });
  }

  async createShift(claims: JwtClaims, s: CreateShiftDto): Promise<ShiftResponseDto> {
    return this.uow.asCaller(claims, async () => {
      const row = await this.repo.insertShift({
        name: s.name,
        key: s.key || null,
        checkinOpen: s.checkin_open || null,
        checkinLate: s.checkin_late || null,
        checkinClose: s.checkin_close || null,
        checkoutOpen: s.checkout_open || null,
        checkoutClose: s.checkout_close || null,
        startTime: s.checkin_late || s.start_time,
        endTime: s.checkout_open || s.end_time,
        lateGraceMinutes: 0,
        lateFrom: null,
        lateTo: null,
      });
      return CatalogMapper.toShiftDto(row);
    });
  }

  async updateShift(claims: JwtClaims, id: string, s: UpdateShiftDto): Promise<ShiftResponseDto> {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.updateShift(id, {
        name: s.name,
        key: s.key || null,
        checkinOpen: s.checkin_open || null,
        checkinLate: s.checkin_late || null,
        checkinClose: s.checkin_close || null,
        checkoutOpen: s.checkout_open || null,
        checkoutClose: s.checkout_close || null,
        startTime: s.checkin_late || s.start_time,
        endTime: s.checkout_open || s.end_time,
        lateGraceMinutes: 0,
        lateFrom: null,
        lateTo: null,
      });
      if (!result) throw notFound();
      return CatalogMapper.toShiftDto(result);
    });
  }

  async deleteShift(claims: JwtClaims, id: string): Promise<void> {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.deleteShift(id);
      if (!result) throw notFound();
    });
  }
}
