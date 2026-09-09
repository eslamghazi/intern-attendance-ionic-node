import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { CatalogRepository } from './catalog.repository.js';
import type { JwtClaims } from '../../db/context.js';
import { notFound } from '../../http/errors.js';

@Injectable()
export class CatalogService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: CatalogRepository,
  ) {}

  /* Institutions */
  async getInstitutions(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getInstitutions();
    });
  }

  async createInstitution(claims: JwtClaims, data: { name: string; code: number }) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.insertInstitution(data.name, data.code);
    });
  }

  async updateInstitution(claims: JwtClaims, id: string, data: { name: string; code: number }) {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.updateInstitution(id, data.name, data.code);
      if (!result) throw notFound();
      return result;
    });
  }

  async deleteInstitution(claims: JwtClaims, id: string) {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.deleteInstitution(id);
      if (!result) throw notFound();
    });
  }

  /* Branches */
  async getBranches(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getBranches();
    });
  }

  async getBranchesOptions(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getBranchesOptions();
    });
  }

  async createBranch(claims: JwtClaims, b: Record<string, any>) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.insertBranch({
        name: b.name,
        address: b.address || null,
        latitude: b.latitude,
        longitude: b.longitude,
        radiusMeters: b.radius_meters,
        areaCoords: b.area_coords && b.area_coords.length >= 3 ? b.area_coords : null,
        institutionId: b.institution_id || null,
        bypassFace: b.bypass_face,
        bypassLocation: b.bypass_location,
        bypassCheckoutWindow: b.bypass_checkout_window,
        requireQr: b.require_qr,
        qrEnabled: b.require_qr ? true : b.qr_enabled,
        blockCheckin: b.block_checkin,
      });
    });
  }

  async updateBranch(claims: JwtClaims, id: string, b: Record<string, any>) {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.updateBranch(id, {
        name: b.name,
        address: b.address || null,
        latitude: b.latitude,
        longitude: b.longitude,
        radiusMeters: b.radius_meters,
        areaCoords: b.area_coords && b.area_coords.length >= 3 ? b.area_coords : null,
        institutionId: b.institution_id || null,
        bypassFace: b.bypass_face,
        bypassLocation: b.bypass_location,
        bypassCheckoutWindow: b.bypass_checkout_window,
        requireQr: b.require_qr,
        qrEnabled: b.require_qr ? true : b.qr_enabled,
        blockCheckin: b.block_checkin,
      });
      if (!result) throw notFound();
      return result;
    });
  }

  async deleteBranch(claims: JwtClaims, id: string) {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.deleteBranch(id);
      if (!result) throw notFound();
    });
  }

  /* Groups */
  async getGroups(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getGroups();
    });
  }

  async getGroupsOptions(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getGroupsOptions();
    });
  }

  async createGroup(claims: JwtClaims, g: Record<string, any>) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.insertGroup({
        name: g.name,
        year: g.year,
        institutionId: g.institution_id || null,
        branchId: g.branch_id || null,
        startDate: g.start_date || null,
        endDate: g.end_date || null,
        bypassFace: g.bypass_face,
        bypassLocation: g.bypass_location,
        bypassCheckoutWindow: g.bypass_checkout_window,
      });
    });
  }

  async updateGroup(claims: JwtClaims, id: string, g: Record<string, any>) {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.updateGroup(id, {
        name: g.name,
        year: g.year,
        institutionId: g.institution_id || null,
        branchId: g.branch_id || null,
        startDate: g.start_date || null,
        endDate: g.end_date || null,
        bypassFace: g.bypass_face,
        bypassLocation: g.bypass_location,
        bypassCheckoutWindow: g.bypass_checkout_window,
      });
      if (!result) throw notFound();
      return result;
    });
  }

  async deleteGroup(claims: JwtClaims, id: string) {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.deleteGroup(id);
      if (!result) throw notFound();
    });
  }

  /* Shifts */
  async getShifts(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getShifts();
    });
  }

  async getShiftsKeys(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getShiftsKeys();
    });
  }

  async createShift(claims: JwtClaims, s: Record<string, any>) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.insertShift({
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
    });
  }

  async updateShift(claims: JwtClaims, id: string, s: Record<string, any>) {
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
      return result;
    });
  }

  async deleteShift(claims: JwtClaims, id: string) {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.deleteShift(id);
      if (!result) throw notFound();
    });
  }
}
