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
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { BCRYPT_COST } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { Role } from '../../common/enums/index.js';
import { checkSuperadminConfig } from '../../domain/identity/seedConfig.js';
import { UnitOfWorkService } from './unit-of-work.service.js';
import { profiles } from './schema/index.js';
/**
 * The first way in.
 *
 * A freshly migrated database has no accounts at all, so there is no way to
 * sign in and therefore no way to create one. This makes the account named by
 * SUPERADMIN_NATIONAL_ID / SUPERADMIN_PASSWORD, once, at start-up.
 *
 * IT CREATES, IT DOES NOT MAINTAIN
 *
 * An existing account is left exactly as it is. Re-hashing the env password on
 * every boot would mean a superadmin who changed their password gets it
 * reverted on the next restart, and that whoever can read the environment holds
 * a permanent key rather than a first one.
 *
 * WHY NOT A MIGRATION
 *
 * The password has to be bcrypt-hashed, which no migration can do: the schema
 * installs no extensions, so there is no pgcrypto in the database to hash with.
 * And a migration is checksummed and applied once — it cannot read an
 * environment that differs per deployment. This is the same reasoning that
 * keeps the app_settings row out of the migrations: a seed is an invariant the
 * APPLICATION requires, so the application asserts it.
 */
let SuperadminSeedService = class SuperadminSeedService {
    uow;
    constructor(uow) {
        this.uow = uow;
    }
    async ensure() {
        const nationalId = env.SUPERADMIN_NATIONAL_ID;
        const password = env.SUPERADMIN_PASSWORD;
        // The rule lives in domain/identity/seedConfig.ts — pure, and tested
        // without a database, because the placeholder refusal is a security
        // property rather than a convenience.
        const verdict = checkSuperadminConfig(nationalId, password);
        if (verdict.kind === 'skip')
            return;
        if (verdict.kind === 'refuse') {
            throw new Error(`[seed] refusing to seed the superadmin: ${verdict.why}`);
        }
        await this.uow.transaction(async (tx) => {
            const existing = await tx
                .select({ id: profiles.id, role: profiles.role })
                .from(profiles)
                .where(eq(profiles.nationalId, nationalId))
                .limit(1);
            if (existing[0]) {
                console.log(`[seed] superadmin ${nationalId} already exists — left untouched` +
                    (existing[0].role === Role.SUPERADMIN ? '' : ` (role: ${existing[0].role})`));
                return;
            }
            await tx.insert(profiles).values({
                role: Role.SUPERADMIN,
                fullName: env.SUPERADMIN_NAME,
                nationalId,
                passwordHash: await bcrypt.hash(password, BCRYPT_COST),
            });
            console.log(`[seed] superadmin created: ${env.SUPERADMIN_NAME} (${nationalId})`);
        });
    }
};
SuperadminSeedService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService])
], SuperadminSeedService);
export { SuperadminSeedService };
//# sourceMappingURL=superadmin-seed.service.js.map