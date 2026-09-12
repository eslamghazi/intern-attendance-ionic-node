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
import { randomBytes } from 'node:crypto';
import { chmodSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { BCRYPT_COST, FIRST_SUPERADMIN, FIRST_SUPERADMIN_FILE, FIRST_SUPERADMIN_PASSWORD_BYTES, } from '../../config/constants.js';
import { Role } from '../../common/enums/index.js';
import { UnitOfWorkService } from './unit-of-work.service.js';
import { profiles } from './schema/index.js';
/**
 * The first way in.
 *
 * A freshly migrated database has no accounts, so there is no way to sign in
 * and therefore no way to create one. This makes exactly one superadmin, with a
 * password generated for this installation, and prints it once.
 *
 * THE TRIGGER IS "NO SUPERADMIN EXISTS", NOT "THIS ACCOUNT IS MISSING"
 *
 * That is what makes it a recovery path rather than a fixture. A system that
 * has lost every superadmin — deleted, or a restore that went wrong — gets a
 * way back in on the next restart. A system that has one is never touched, so a
 * renamed or re-credentialed account is left alone.
 *
 * NO CREDENTIALS IN THE ENVIRONMENT
 *
 * This used to read SUPERADMIN_NATIONAL_ID and SUPERADMIN_PASSWORD. An
 * environment file is a copy of a secret that outlives the five minutes it was
 * needed for: it gets committed, pasted into a ticket, and read by anything
 * that can list the process's environment. Generating the password here means
 * it exists in exactly two places — the bcrypt hash in the database, and one
 * file on disk that the operator is told to delete.
 */
let SuperadminSeedService = class SuperadminSeedService {
    uow;
    constructor(uow) {
        this.uow = uow;
    }
    async ensure() {
        await this.uow.transaction(async (tx) => {
            const existing = await tx
                .select({ id: profiles.id })
                .from(profiles)
                .where(eq(profiles.role, Role.SUPERADMIN))
                .limit(1);
            if (existing[0])
                return; // somebody can already get in
            // base64url: no '+', '/' or '=' to be mangled by a shell, a URL or a
            // copy-paste out of a log.
            const password = randomBytes(FIRST_SUPERADMIN_PASSWORD_BYTES).toString('base64url');
            await tx.insert(profiles).values({
                role: Role.SUPERADMIN,
                fullName: FIRST_SUPERADMIN.fullName,
                nationalId: FIRST_SUPERADMIN.nationalId,
                passwordHash: await bcrypt.hash(password, BCRYPT_COST),
            });
            this.announce(password);
        });
    }
    /**
     * Tell the operator twice: once on the console, once in a file.
     *
     * The console alone is not enough — a container's first log lines are the
     * easiest thing in the world to lose to a restart, a log rotation, or a
     * deploy tool that shows only the last twenty lines. The file alone is not
     * enough either, because somebody watching the boot should see it happen.
     *
     * A failure to write is NOT fatal. The account exists and the password is on
     * the console; refusing to start over a read-only working directory would
     * trade a minor inconvenience for an outage.
     */
    announce(password) {
        const path = resolve(process.cwd(), FIRST_SUPERADMIN_FILE);
        let written = '';
        try {
            writeFileSync(path, [
                'The first superadmin for this installation.',
                '',
                `national id: ${FIRST_SUPERADMIN.nationalId}`,
                `password:    ${password}`,
                '',
                'Sign in, change this password, then delete this file.',
                '',
            ].join('\n'), { encoding: 'utf8', mode: 0o600 });
            // writeFileSync's `mode` applies only when it CREATES the file; an
            // existing one keeps the permissions it had, so set them explicitly.
            chmodSync(path, 0o600);
            written = path;
        }
        catch (err) {
            console.error(`[seed] could not write ${path} (${err instanceof Error ? err.message : String(err)}) — ` +
                'the password is on this console and nowhere else. Copy it now.');
        }
        const rule = '='.repeat(72);
        console.log([
            '',
            rule,
            '  FIRST SUPERADMIN CREATED — shown once, and never again',
            '',
            `    national id  ${FIRST_SUPERADMIN.nationalId}`,
            `    password     ${password}`,
            '',
            ...(written ? [`  Also written to ${written} — delete it once you are in.`] : []),
            '  Change this password after signing in.',
            rule,
            '',
        ].join('\n'));
    }
};
SuperadminSeedService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService])
], SuperadminSeedService);
export { SuperadminSeedService };
//# sourceMappingURL=superadmin-seed.service.js.map