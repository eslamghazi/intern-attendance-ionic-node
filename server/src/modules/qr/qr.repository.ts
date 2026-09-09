import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository.js';
import { appSettings, members, branches, qrTokens } from '../../db/schema/index.js';
import { eq, lt, gt, and, isNull, or, not } from 'drizzle-orm';

@Injectable()
export class QrRepository extends BaseRepository {
  async getSettings() {
    const rows = await this.db
      .select({
        qr_requires_member: appSettings.qrRequiresMember,
        qr_validity_seconds: appSettings.qrValiditySeconds,
        qr_bypass_minutes: appSettings.qrBypassMinutes,
        checkin_method: appSettings.checkinMethod,
      })
      .from(appSettings)
      .where(eq(appSettings.id, 1));
      
    return rows[0] ?? {
      qr_requires_member: null,
      qr_validity_seconds: null,
      qr_bypass_minutes: null,
      checkin_method: null,
    };
  }

  async getMemberByProfileId(profileId: string) {
    const rows = await this.db
      .select({
        branch_id: members.branchId,
        can_generate_qr: members.canGenerateQr,
      })
      .from(members)
      .where(eq(members.profileId, profileId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getBranchQrEnabled(branchId: string) {
    const rows = await this.db
      .select({ qr_enabled: branches.qrEnabled })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);
    return rows[0]?.qr_enabled ?? null;
  }

  async deleteExpiredTokens() {
    await this.db.delete(qrTokens).where(lt(qrTokens.expiresAt, new Date().toISOString()));
  }

  async insertToken(data: {
    token: string;
    branchId: string;
    date: string;
    memberId: string | null;
    singleUse: boolean;
    expiresAt: string;
    createdBy: string;
  }) {
    await this.db.insert(qrTokens).values(data);
  }

  async getMemberWithBranch(profileId: string) {
    const rows = await this.db
      .select({
        id: members.id,
        branch_id: members.branchId,
        qr_enabled: branches.qrEnabled,
        block_checkin: branches.blockCheckin,
      })
      .from(members)
      .leftJoin(branches, eq(branches.id, members.branchId))
      .where(eq(members.profileId, profileId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getValidToken(
    token: string,
    branchId: string,
    date: string,
    memberId: string,
    qrRequiresMember: boolean,
  ) {
    const rows = await this.db
      .select({ id: qrTokens.id, single_use: qrTokens.singleUse })
      .from(qrTokens)
      .where(
        and(
          eq(qrTokens.token, token),
          eq(qrTokens.branchId, branchId),
          eq(qrTokens.date, date),
          gt(qrTokens.expiresAt, new Date().toISOString()),
          or(eq(qrTokens.singleUse, false), isNull(qrTokens.usedAt)),
          or(isNull(qrTokens.memberId), eq(qrTokens.memberId, memberId)),
          qrRequiresMember === false ? undefined : isNotNull(qrTokens.memberId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async markTokenUsed(id: string) {
    await this.db
      .update(qrTokens)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(qrTokens.id, id));
  }

  async updateMemberBypass(memberId: string, bypassUntil: string) {
    const rows = await this.db
      .update(members)
      .set({ locationBypassUntil: bypassUntil })
      .where(eq(members.id, memberId))
      .returning({ locationBypassUntil: members.locationBypassUntil });
    return rows[0] ?? null;
  }
}

// Need to define a small helper for isNotNull to be exported properly or just use not(isNull())
import { isNotNull } from 'drizzle-orm';
