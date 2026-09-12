import { Injectable } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { UnitOfWorkService } from '../database/unit-of-work.service.js';
import { appSettings } from '../database/schema/index.js';
import { sendReport } from './render.js';
import type { ReportBranding, ReportDocument, ReportFormat } from './export.types.js';

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
@Injectable()
export class ExportService {
  constructor(private readonly uow: UnitOfWorkService) {}

  /** The organisation's name and logo, as set on the Settings page. */
  async branding(): Promise<ReportBranding> {
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

  async send(reply: FastifyReply, format: ReportFormat, doc: ReportDocument, basename: string): Promise<void> {
    await sendReport(reply, format, { ...(await this.branding()), ...doc }, basename);
  }
}
