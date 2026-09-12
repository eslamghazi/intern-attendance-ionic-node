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
import { SuperadminRepository } from './superadmin.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditEvent, Role } from '../../common/enums/index.js';
import { badRequest } from '../../common/errors.js';
import { parseSuperadminBackup, SUPERADMIN_BACKUP_KIND, SUPERADMIN_BACKUP_VERSION, } from '../../domain/backup/superadminBackup.js';
/**
 * Backing up and restoring the accounts that can do everything.
 *
 * WHY THIS IS A FEATURE AND NOT A SCRIPT ONLY
 *
 * The scripts need a shell and the database URL, which is exactly what the
 * person who needs them usually does not have at the moment they need them.
 * Losing every superadmin locks an institution out of its own system, and the
 * fix should not require finding whoever set the server up.
 */
let SuperadminService = class SuperadminService {
    uow;
    repo;
    audit;
    constructor(uow, repo, audit) {
        this.uow = uow;
        this.repo = repo;
        this.audit = audit;
    }
    /** The accounts, for the page. No hashes. */
    async list() {
        return this.uow.transaction(async () => this.repo.listForDisplay());
    }
    /**
     * The backup file.
     *
     * Downloading one is recorded: it is the moment every superadmin password
     * hash in the system leaves it, and a trail that shows who took a copy and
     * when is the difference between an export and a quiet one.
     */
    async backup(caller) {
        return this.uow.transaction(async () => {
            const rows = await this.repo.listForBackup();
            await this.audit.record(caller.id, AuditEvent.SUPERADMIN_BACKUP, {
                accounts: rows.length,
            });
            return {
                kind: SUPERADMIN_BACKUP_KIND,
                version: SUPERADMIN_BACKUP_VERSION,
                taken_at: new Date().toISOString(),
                accounts: rows.map((r) => ({
                    full_name: r.fullName,
                    national_id: r.nationalId,
                    phone: r.phone,
                    email: r.email,
                    avatar_url: r.avatarUrl,
                    password_hash: r.passwordHash,
                    is_active: r.isActive,
                })),
            };
        });
    }
    /**
     * Put accounts back.
     *
     * ONE TRANSACTION. A half-restored set of superadmins is worse than none,
     * because it looks like it worked.
     *
     * `overwrite` is what separates the ordinary case — "we lost the accounts,
     * put them back" — from the dangerous one. Without it an account that still
     * exists is reported and skipped rather than having its password replaced by
     * whatever is in the file.
     */
    async restore(caller, file, overwrite) {
        const parsed = parseSuperadminBackup(file);
        if (!parsed.ok)
            throw badRequest('invalid_backup', parsed.why);
        return this.uow.transaction(async () => {
            const accounts = [];
            let added = 0;
            let overwritten = 0;
            let skipped = 0;
            for (const a of parsed.accounts) {
                const existing = await this.repo.findByNationalId(a.nationalId);
                if (!existing) {
                    await this.repo.insertSuperadmin(a);
                    accounts.push({ national_id: a.nationalId, full_name: a.fullName, outcome: 'added' });
                    added++;
                    continue;
                }
                // YOUR OWN ACCOUNT IS NEVER OVERWRITTEN.
                //
                // Restoring an old backup over yourself replaces your password with the
                // one you had when it was taken — which you have probably forgotten,
                // and you find out at the next sign-in. The recovery this exists for is
                // other people's accounts; there is no version of it that needs to
                // change the password of the person doing it.
                if (existing.id === caller.id) {
                    accounts.push({
                        national_id: a.nationalId,
                        full_name: a.fullName,
                        outcome: 'skipped',
                        reason: 'this is your own account',
                    });
                    skipped++;
                    continue;
                }
                if (!overwrite) {
                    accounts.push({
                        national_id: a.nationalId,
                        full_name: a.fullName,
                        outcome: 'skipped',
                        reason: 'already exists',
                    });
                    skipped++;
                    continue;
                }
                await this.repo.overwriteSuperadmin(existing.id, a);
                accounts.push({
                    national_id: a.nationalId,
                    full_name: a.fullName,
                    outcome: 'overwritten',
                    ...(existing.role !== Role.SUPERADMIN ? { reason: `was ${existing.role}` } : {}),
                });
                overwritten++;
            }
            await this.audit.record(caller.id, AuditEvent.SUPERADMIN_RESTORE, {
                added,
                overwritten,
                skipped,
                overwrite_requested: overwrite,
            });
            return { added, overwritten, skipped, accounts };
        });
    }
};
SuperadminService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        SuperadminRepository,
        AuditService])
], SuperadminService);
export { SuperadminService };
//# sourceMappingURL=superadmin.service.js.map