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
import { UnitOfWorkService } from '../database/unit-of-work.service.js';
import { appSettings } from '../database/schema/index.js';
import { sendReport } from './render.js';
/**
 * Sends a report with the organisation's branding on it.
 *
 * Every export used to go out under the app's own title only: the document
 * type had a `brandName` slot and nothing filled it, so a file printed for
 * the faculty carried no faculty on it. The name and logo live in
 * app_settings — the logo as a data URL, which is exactly what a print
 * document can embed with no second request — and this is the one place they
 * are read for a report, so the five export routes cannot drift on it.
 */
let ExportService = class ExportService {
    uow;
    constructor(uow) {
        this.uow = uow;
    }
    /** The organisation's name and logo, as set on the Settings page. */
    async branding() {
        return this.uow.transaction(async (tx) => {
            const rows = await tx
                .select({ name: appSettings.orgName, logo: appSettings.orgLogoUrl })
                .from(appSettings)
                .where(eq(appSettings.id, 1))
                .limit(1);
            const row = rows[0];
            return {
                brandName: row?.name?.trim() || undefined,
                // Only an embedded image is safe to put in a document that prints
                // itself: a remote URL would be a request the reader's browser makes
                // at print time, and may not resolve there.
                brandLogo: row?.logo?.startsWith('data:image/') ? row.logo : undefined,
            };
        });
    }
    async send(reply, format, doc, basename) {
        await sendReport(reply, format, { ...(await this.branding()), ...doc }, basename);
    }
};
ExportService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService])
], ExportService);
export { ExportService };
//# sourceMappingURL=export.service.js.map