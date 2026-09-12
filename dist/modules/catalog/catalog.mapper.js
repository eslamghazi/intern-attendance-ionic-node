export class CatalogMapper {
    static toInstitutionDto(row) {
        return {
            id: row.id,
            name: row.name,
            code: Number(row.code ?? 0),
            created_at: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        };
    }
    static toInstitutionList(rows) {
        return rows.map((r) => this.toInstitutionDto(r));
    }
    static toBranchDto(row) {
        return {
            id: row.id,
            name: row.name,
            address: row.address ?? null,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            radius_meters: Number(row.radiusMeters),
            institution_id: row.institutionId ?? null,
            bypass_face: row.bypassFace ?? false,
            bypass_location: row.bypassLocation ?? false,
            bypass_checkout_window: row.bypassCheckoutWindow ?? false,
            require_qr: row.requireQr ?? false,
            qr_enabled: row.qrEnabled ?? true,
            block_checkin: row.blockCheckin ?? false,
        };
    }
    static toBranchList(rows) {
        return rows.map((r) => this.toBranchDto(r));
    }
    static toBranchOptionDto(row) {
        return {
            id: row.id,
            name: row.name,
        };
    }
    static toBranchOptionList(rows) {
        return rows.map((r) => this.toBranchOptionDto(r));
    }
    static toGroupDto(row) {
        return {
            id: row.id,
            name: row.name,
            year: Number(row.year),
            institution_id: row.institutionId ?? null,
            branch_id: row.branchId ?? null,
            start_date: row.startDate ?? null,
            end_date: row.endDate ?? null,
            bypass_face: row.bypassFace ?? false,
            bypass_location: row.bypassLocation ?? false,
            bypass_checkout_window: row.bypassCheckoutWindow ?? false,
        };
    }
    static toGroupList(rows) {
        return rows.map((r) => this.toGroupDto(r));
    }
    static toGroupOptionDto(row) {
        return {
            id: row.id,
            name: row.name,
        };
    }
    static toGroupOptionList(rows) {
        return rows.map((r) => this.toGroupOptionDto(r));
    }
    static toShiftDto(row) {
        return {
            id: row.id,
            name: row.name,
            key: row.key ?? null,
            checkin_open: row.checkinOpen ?? null,
            checkin_late: row.checkinLate ?? null,
            checkin_close: row.checkinClose ?? null,
            checkout_open: row.checkoutOpen ?? null,
            checkout_close: row.checkoutClose ?? null,
            start_time: row.startTime,
            end_time: row.endTime,
        };
    }
    static toShiftList(rows) {
        return rows.map((r) => this.toShiftDto(r));
    }
}
//# sourceMappingURL=catalog.mapper.js.map