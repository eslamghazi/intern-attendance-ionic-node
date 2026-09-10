import { relations } from "drizzle-orm/relations";
import { profiles, attachments, members, groups, branches, faceTemplates, institutions, rosterDays, shifts, adminAssignments, auditLog, attendance, qrTokens, departments, memberDepartments, presenceChecks, presenceConfirmations } from "./tables.js";
export const profilesRelations = relations(profiles, ({ one, many }) => ({
    // The admin who created this account, and the accounts it created. This was
    // a relation to auth.users until that table was dropped; created_by has
    // always held a profile id, since every auth user had a profile.
    createdByProfile: one(profiles, {
        fields: [profiles.createdBy],
        references: [profiles.id],
        relationName: "profiles_created_by"
    }),
    createdProfiles: many(profiles, { relationName: "profiles_created_by" }),
    members: many(members),
    adminAssignments: many(adminAssignments),
    auditLogs: many(auditLog),
    presenceChecks: many(presenceChecks),
}));
export const attachmentsRelations = relations(attachments, ({ one }) => ({
    owner: one(profiles, {
        fields: [attachments.ownerId],
        references: [profiles.id]
    }),
}));
export const membersRelations = relations(members, ({ one, many }) => ({
    profile: one(profiles, {
        fields: [members.profileId],
        references: [profiles.id]
    }),
    group: one(groups, {
        fields: [members.groupId],
        references: [groups.id]
    }),
    branch: one(branches, {
        fields: [members.branchId],
        references: [branches.id]
    }),
    faceTemplates: many(faceTemplates),
    rosterDays: many(rosterDays),
    attendances: many(attendance),
    qrTokens: many(qrTokens),
    memberDepartments: many(memberDepartments),
    presenceConfirmations: many(presenceConfirmations),
}));
export const groupsRelations = relations(groups, ({ one, many }) => ({
    members: many(members),
    institution: one(institutions, {
        fields: [groups.institutionId],
        references: [institutions.id]
    }),
    branch: one(branches, {
        fields: [groups.branchId],
        references: [branches.id]
    }),
    adminAssignments: many(adminAssignments),
    presenceChecks: many(presenceChecks),
}));
export const branchesRelations = relations(branches, ({ one, many }) => ({
    members: many(members),
    institution: one(institutions, {
        fields: [branches.institutionId],
        references: [institutions.id]
    }),
    groups: many(groups),
    adminAssignments: many(adminAssignments),
    attendances: many(attendance),
    qrTokens: many(qrTokens),
    departments: many(departments),
    presenceChecks: many(presenceChecks),
}));
export const faceTemplatesRelations = relations(faceTemplates, ({ one }) => ({
    member: one(members, {
        fields: [faceTemplates.memberId],
        references: [members.id]
    }),
}));
export const institutionsRelations = relations(institutions, ({ many }) => ({
    branches: many(branches),
    groups: many(groups),
}));
export const rosterDaysRelations = relations(rosterDays, ({ one }) => ({
    member: one(members, {
        fields: [rosterDays.memberId],
        references: [members.id]
    }),
    shift: one(shifts, {
        fields: [rosterDays.shiftId],
        references: [shifts.id]
    }),
}));
export const shiftsRelations = relations(shifts, ({ many }) => ({
    rosterDays: many(rosterDays),
    attendances: many(attendance),
    presenceChecks: many(presenceChecks),
}));
export const adminAssignmentsRelations = relations(adminAssignments, ({ one }) => ({
    profile: one(profiles, {
        fields: [adminAssignments.adminId],
        references: [profiles.id]
    }),
    group: one(groups, {
        fields: [adminAssignments.groupId],
        references: [groups.id]
    }),
    branch: one(branches, {
        fields: [adminAssignments.branchId],
        references: [branches.id]
    }),
}));
export const auditLogRelations = relations(auditLog, ({ one }) => ({
    profile: one(profiles, {
        fields: [auditLog.actorId],
        references: [profiles.id]
    }),
}));
export const attendanceRelations = relations(attendance, ({ one }) => ({
    member: one(members, {
        fields: [attendance.memberId],
        references: [members.id]
    }),
    branch: one(branches, {
        fields: [attendance.branchId],
        references: [branches.id]
    }),
    shift: one(shifts, {
        fields: [attendance.shiftId],
        references: [shifts.id]
    }),
}));
export const qrTokensRelations = relations(qrTokens, ({ one }) => ({
    branch: one(branches, {
        fields: [qrTokens.branchId],
        references: [branches.id]
    }),
    member: one(members, {
        fields: [qrTokens.memberId],
        references: [members.id]
    }),
}));
export const departmentsRelations = relations(departments, ({ one, many }) => ({
    branch: one(branches, {
        fields: [departments.branchId],
        references: [branches.id]
    }),
    memberDepartments: many(memberDepartments),
    presenceChecks: many(presenceChecks),
}));
export const memberDepartmentsRelations = relations(memberDepartments, ({ one }) => ({
    member: one(members, {
        fields: [memberDepartments.memberId],
        references: [members.id]
    }),
    department: one(departments, {
        fields: [memberDepartments.departmentId],
        references: [departments.id]
    }),
}));
export const presenceChecksRelations = relations(presenceChecks, ({ one, many }) => ({
    profile: one(profiles, {
        fields: [presenceChecks.createdBy],
        references: [profiles.id]
    }),
    branch: one(branches, {
        fields: [presenceChecks.branchId],
        references: [branches.id]
    }),
    group: one(groups, {
        fields: [presenceChecks.groupId],
        references: [groups.id]
    }),
    department: one(departments, {
        fields: [presenceChecks.departmentId],
        references: [departments.id]
    }),
    shift: one(shifts, {
        fields: [presenceChecks.shiftId],
        references: [shifts.id]
    }),
    presenceConfirmations: many(presenceConfirmations),
}));
export const presenceConfirmationsRelations = relations(presenceConfirmations, ({ one }) => ({
    presenceCheck: one(presenceChecks, {
        fields: [presenceConfirmations.checkId],
        references: [presenceChecks.id]
    }),
    member: one(members, {
        fields: [presenceConfirmations.memberId],
        references: [members.id]
    }),
}));
//# sourceMappingURL=relations.js.map