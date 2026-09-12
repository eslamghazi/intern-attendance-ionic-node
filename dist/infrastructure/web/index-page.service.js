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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { UnitOfWorkService } from '../database/unit-of-work.service.js';
import { appSettings } from '../database/schema/index.js';
import { brandIndexHtml } from './index-page.js';
import { BRANDING_LOGO_PATH, BRANDING_TTL_MS } from './index-page.constants.js';
/**
 * Serves the app's index.html with the organisation's name and logo in its
 * preview tags — see index-page.ts for why that cannot happen in the app.
 *
 * The file is read once: it is Vite's output and does not change while the
 * process runs. The branding is read from Settings and remembered for a
 * short while, because every visit to the app fetches this page and one
 * query per page load is one query too many for a value that changes once
 * a year.
 */
let IndexPageService = class IndexPageService {
    uow;
    html = null;
    branding = null;
    /** The built client's folder, once found; the logo route reads its icon. */
    clientDist = null;
    constructor(uow) {
        this.uow = uow;
    }
    /** Point at the built client. Called once from bootstrap, when it is found. */
    load(clientDist) {
        this.clientDist = clientDist;
        this.html = readFileSync(join(clientDist, 'index.html'), 'utf8');
    }
    get available() {
        return this.html !== null;
    }
    async publicBranding() {
        const now = Date.now();
        if (this.branding && now - this.branding.at < BRANDING_TTL_MS)
            return this.branding.value;
        const value = await this.uow.transaction(async (tx) => {
            const rows = await tx
                .select({ name: appSettings.orgName, logo: appSettings.orgLogoUrl })
                .from(appSettings)
                .where(eq(appSettings.id, 1))
                .limit(1);
            const row = rows[0];
            return {
                name: row?.name?.trim() || undefined,
                logo: /^data:image\/(png|jpeg);base64,/.test(row?.logo ?? '') ? row.logo : undefined,
            };
        });
        this.branding = { value, at: now };
        return value;
    }
    /** Forget the remembered branding — Settings just changed it. */
    invalidate() {
        this.branding = null;
    }
    /** The page for one request. */
    async render(req) {
        if (this.html === null)
            throw new Error('index.html was never loaded');
        const origin = `${req.protocol}://${req.host}`;
        const { name } = await this.publicBranding();
        return brandIndexHtml(this.html, {
            orgName: name,
            origin,
            imageUrl: `${origin}${BRANDING_LOGO_PATH}`,
        });
    }
};
IndexPageService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService])
], IndexPageService);
export { IndexPageService };
//# sourceMappingURL=index-page.service.js.map