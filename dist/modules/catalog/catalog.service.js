var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { CatalogRepository } from './catalog.repository.js';
import { notFound, badRequest } from '../../common/errors.js';
import { CatalogMapper } from './catalog.mapper.js';
import { scopeOf } from '../../common/auth/access.service.js';
import { coversUnit } from '../../domain/access/scope.js';
let CatalogService = class CatalogService {
    uow;
    repo;
    constructor(uow, repo) {
        this.uow = uow;
        this.repo = repo;
    }
    /* Institutions */
    async getInstitutions() {
        return this.uow.transaction(async () => {
            const rows = await this.repo.getInstitutions();
            return CatalogMapper.toInstitutionList(rows);
        });
    }
    async createInstitution(data) {
        return this.uow.transaction(async () => {
            const row = await this.repo.insertInstitution(data.name, data.code ?? 0);
            return CatalogMapper.toInstitutionDto(row);
        });
    }
    async updateInstitution(id, data) {
        return this.uow.transaction(async () => {
            const result = await this.repo.updateInstitution(id, data.name, data.code ?? 0);
            if (!result)
                throw notFound();
            return CatalogMapper.toInstitutionDto(result);
        });
    }
    async deleteInstitution(id) {
        return this.uow.transaction(async () => {
            const result = await this.repo.deleteInstitution(id);
            if (!result)
                throw notFound();
        });
    }
    /* Branches */
    async getBranches() {
        return this.uow.transaction(async () => {
            const rows = await this.repo.getBranches();
            return CatalogMapper.toBranchList(rows);
        });
    }
    /**
     * The branches a caller may pick from.
     *
     * NARROWED to their assignments, and that is not cosmetic. These options fill
     * the branch selector on every report screen, and the reads behind those
     * screens are scoped — so an unnarrowed list offers an admin branches whose
     * data they will then be shown none of. Worse, the names themselves are the
     * one thing an assigned admin is not supposed to enumerate.
     */
    async getBranchesOptions(caller) {
        return this.uow.transaction(async (tx) => {
            const rows = await this.repo.getBranchesOptions();
            const scope = await scopeOf(tx, caller);
            const visible = scope.kind === 'all'
                ? rows
                : scope.kind === 'none'
                    ? []
                    : rows.filter((r) => coversUnit(scope, { branchId: r.id, groupId: null }));
            return CatalogMapper.toBranchOptionList(visible);
        });
    }
    /**
     * The polygon geofence, checked before it is stored.
     *
     * WHY THIS IS HERE
     *
     * `area_coords` is a plain jsonb column, so the database will accept any shape
     * at all — it has no geometry type to object with.
     *
     * Without a check here the failure moves to the worst possible place: the
     * column accepts `lat: 310.5`, the admin is told the branch saved, and
     * readRing() quietly rejects the ring at CHECK-IN time and falls back to the
     * radius. The geofence is then silently not the one on the map, and the first
     * person to find out is a student being refused.
     *
     * So it is refused at the point of entry, where there is someone to tell.
     *
     * Fewer than three vertices is NOT an error: that is how the admin UI stores
     * "circle mode", and it means "no polygon" — the same reading readRing() has.
     */
    validatedRing(coords) {
        if (!Array.isArray(coords) || coords.length < 3)
            return null;
        const ring = [];
        for (const [i, entry] of coords.entries()) {
            const at = `point ${i + 1}`;
            if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
                throw badRequest('invalid_area', `${at} of the area is not a coordinate`);
            }
            const { lat, lng } = entry;
            if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
                throw badRequest('invalid_area', `${at} of the area has a non-numeric lat/lng`);
            }
            if (lat < -90 || lat > 90) {
                throw badRequest('invalid_area', `${at}: latitude ${lat} is outside -90..90`);
            }
            if (lng < -180 || lng > 180) {
                throw badRequest('invalid_area', `${at}: longitude ${lng} is outside -180..180`);
            }
            ring.push({ lat, lng });
        }
        return ring;
    }
    async createBranch(b) {
        return this.uow.transaction(async () => {
            const row = await this.repo.insertBranch({
                name: b.name,
                address: b.address || null,
                latitude: b.latitude,
                longitude: b.longitude,
                radiusMeters: b.radius_meters,
                areaCoords: this.validatedRing(b.area_coords),
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
    async updateBranch(id, b) {
        return this.uow.transaction(async () => {
            const result = await this.repo.updateBranch(id, {
                name: b.name,
                address: b.address || null,
                latitude: b.latitude,
                longitude: b.longitude,
                radiusMeters: b.radius_meters,
                areaCoords: this.validatedRing(b.area_coords),
                institutionId: b.institution_id || null,
                bypassFace: b.bypass_face ?? false,
                bypassLocation: b.bypass_location ?? false,
                bypassCheckoutWindow: b.bypass_checkout_window ?? false,
                requireQr: b.require_qr ?? false,
                qrEnabled: b.require_qr ? true : (b.qr_enabled ?? true),
                blockCheckin: b.block_checkin ?? false,
            });
            if (!result)
                throw notFound();
            return CatalogMapper.toBranchDto(result);
        });
    }
    async deleteBranch(id) {
        return this.uow.transaction(async () => {
            const result = await this.repo.deleteBranch(id);
            if (!result)
                throw notFound();
        });
    }
    /* Groups */
    async getGroups() {
        return this.uow.transaction(async () => {
            const rows = await this.repo.getGroups();
            return CatalogMapper.toGroupList(rows);
        });
    }
    /** The groups a caller may pick from — narrowed like the branches above. */
    async getGroupsOptions(caller) {
        return this.uow.transaction(async (tx) => {
            const rows = await this.repo.getGroupsOptions();
            const scope = await scopeOf(tx, caller);
            const visible = scope.kind === 'all'
                ? rows
                : scope.kind === 'none'
                    ? []
                    : rows.filter((r) => coversUnit(scope, { branchId: null, groupId: r.id }));
            return CatalogMapper.toGroupOptionList(visible);
        });
    }
    async createGroup(g) {
        return this.uow.transaction(async () => {
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
    async updateGroup(id, g) {
        return this.uow.transaction(async () => {
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
            if (!result)
                throw notFound();
            return CatalogMapper.toGroupDto(result);
        });
    }
    async deleteGroup(id) {
        return this.uow.transaction(async () => {
            const result = await this.repo.deleteGroup(id);
            if (!result)
                throw notFound();
        });
    }
    /* Shifts */
    async getShifts() {
        return this.uow.transaction(async () => {
            const rows = await this.repo.getShifts();
            return CatalogMapper.toShiftList(rows);
        });
    }
    async getShiftsKeys() {
        return this.uow.transaction(async () => {
            const rows = await this.repo.getShiftsKeys();
            return rows.map((r) => ({ id: r.id, key: r.key ?? null }));
        });
    }
    async createShift(s) {
        return this.uow.transaction(async () => {
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
    async updateShift(id, s) {
        return this.uow.transaction(async () => {
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
            if (!result)
                throw notFound();
            return CatalogMapper.toShiftDto(result);
        });
    }
    async deleteShift(id) {
        return this.uow.transaction(async () => {
            const result = await this.repo.deleteShift(id);
            if (!result)
                throw notFound();
        });
    }
};
CatalogService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        CatalogRepository])
], CatalogService);
export { CatalogService };
//# sourceMappingURL=catalog.service.js.map