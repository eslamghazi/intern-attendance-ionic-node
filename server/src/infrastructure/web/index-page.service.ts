import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { UnitOfWorkService } from '../database/unit-of-work.service.js';
import { appSettings } from '../database/schema/index.js';
import { brandIndexHtml } from './index-page.js';
import { BRANDING_LOGO_PATH, BRANDING_TTL_MS } from './index-page.constants.js';

/** What a request looks like to this service: enough to know its origin. */
export interface OriginSource {
  protocol: string;
  host: string;
}

/** The organisation's public face, as the index page and the logo route need it. */
export interface PublicBranding {
  name?: string;
  /** A `data:image/(png|jpeg);base64,…` URL, or undefined. */
  logo?: string;
}

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
@Injectable()
export class IndexPageService {
  private html: string | null = null;
  private branding: { value: PublicBranding; at: number } | null = null;
  /** The built client's folder, once found; the logo route reads its icon. */
  clientDist: string | null = null;

  constructor(private readonly uow: UnitOfWorkService) {}

  /** Point at the built client. Called once from bootstrap, when it is found. */
  load(clientDist: string): void {
    this.clientDist = clientDist;
    this.html = readFileSync(join(clientDist, 'index.html'), 'utf8');
  }

  get available(): boolean {
    return this.html !== null;
  }

  async publicBranding(): Promise<PublicBranding> {
    const now = Date.now();
    if (this.branding && now - this.branding.at < BRANDING_TTL_MS) return this.branding.value;
    const value = await this.uow.transaction(async (tx) => {
      const rows = await tx
        .select({ name: appSettings.orgName, logo: appSettings.orgLogoUrl })
        .from(appSettings)
        .where(eq(appSettings.id, 1))
        .limit(1);
      const row = rows[0];
      return {
        name: row?.name?.trim() || undefined,
        logo: /^data:image\/(png|jpeg);base64,/.test(row?.logo ?? '') ? row!.logo! : undefined,
      };
    });
    this.branding = { value, at: now };
    return value;
  }

  /** Forget the remembered branding — Settings just changed it. */
  invalidate(): void {
    this.branding = null;
  }

  /** The page for one request. */
  async render(req: OriginSource): Promise<string> {
    if (this.html === null) throw new Error('index.html was never loaded');
    const origin = `${req.protocol}://${req.host}`;
    const { name } = await this.publicBranding();
    return brandIndexHtml(this.html, {
      orgName: name,
      origin,
      imageUrl: `${origin}${BRANDING_LOGO_PATH}`,
    });
  }
}
