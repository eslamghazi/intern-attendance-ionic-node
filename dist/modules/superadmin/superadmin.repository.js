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
import { eq } from 'drizzle-orm';
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { profiles } from '../../infrastructure/database/schema/index.js';
import { Role } from '../../common/enums/index.js';
let SuperadminRepository = class SuperadminRepository extends GenericRepository {
    constructor() {
        super(profiles, profiles.id);
    }
    /**
     * The superadmin accounts, WITHOUT the hash.
     *
     * What the page lists. Enumerated rather than `select *` for the reason
     * AuthRepository.getProfile is: this table holds password_hash, and a bare
     * select is how it reaches a browser.
     */
    async listForDisplay() {
        return this.db
            .select({
            id: profiles.id,
            full_name: profiles.fullName,
            national_id: profiles.nationalId,
            phone: profiles.phone,
            email: profiles.email,
            is_active: profiles.isActive,
            created_at: profiles.createdAt,
        })
            .from(profiles)
            .where(eq(profiles.role, Role.SUPERADMIN))
            .orderBy(profiles.createdAt);
    }
    /**
     * The same accounts WITH the hash, for a backup.
     *
     * Separate from listForDisplay on purpose: the hash is the reason a backup
     * file is a secret, and a single method used for both would put it in every
     * response that only wanted to show a name.
     */
    async listForBackup() {
        return this.db
            .select({
            fullName: profiles.fullName,
            nationalId: profiles.nationalId,
            phone: profiles.phone,
            email: profiles.email,
            avatarUrl: profiles.avatarUrl,
            passwordHash: profiles.passwordHash,
            isActive: profiles.isActive,
        })
            .from(profiles)
            .where(eq(profiles.role, Role.SUPERADMIN))
            .orderBy(profiles.createdAt);
    }
    /** Whoever holds this national id, whatever their role. */
    async findByNationalId(nationalId) {
        const rows = await this.db
            .select({ id: profiles.id, role: profiles.role })
            .from(profiles)
            .where(eq(profiles.nationalId, nationalId))
            .limit(1);
        return rows[0] ?? null;
    }
    async insertSuperadmin(a) {
        await this.db.insert(profiles).values({
            role: Role.SUPERADMIN,
            fullName: a.fullName,
            nationalId: a.nationalId,
            phone: a.phone,
            email: a.email,
            avatarUrl: a.avatarUrl,
            passwordHash: a.passwordHash,
            isActive: a.isActive,
        });
    }
    async overwriteSuperadmin(id, a) {
        await this.db
            .update(profiles)
            .set({
            role: Role.SUPERADMIN,
            fullName: a.fullName,
            phone: a.phone,
            email: a.email,
            avatarUrl: a.avatarUrl,
            passwordHash: a.passwordHash,
            isActive: a.isActive,
        })
            .where(eq(profiles.id, id));
    }
};
SuperadminRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], SuperadminRepository);
export { SuperadminRepository };
//# sourceMappingURL=superadmin.repository.js.map