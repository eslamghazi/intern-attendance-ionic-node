import type { Role } from './types';

/** All client route paths — the single source of truth for navigation. */
export const ROUTES = {
  login: '/login',
  enroll: '/enroll',
  member: {
    home: '/member/home',
    checkIn: '/member/check-in',
    history: '/member/history',
    qr: '/member/qr',
    rosterMaker: '/member/roster-maker',
    faceTool: '/member/face-tool',
    profile: '/member/profile',
    changePassword: '/member/change-password',
  },
  admin: {
    dashboard: '/admin/dashboard',
    groups: '/admin/groups',
    branches: '/admin/branches',
    members: '/admin/members',
    rosters: '/admin/rosters',
    shifts: '/admin/shifts',
    departments: '/admin/departments',
    admins: '/admin/admins',
    review: '/admin/review',
    audit: '/admin/audit',
    presence: '/admin/presence',
    faceTest: '/admin/face-test',
    faceImages: '/admin/face-images',
    memberLookup: '/admin/lookup',
    qr: '/admin/qr',
    rosterMaker: '/admin/roster-maker',
    settings: '/admin/settings',
    profile: '/admin/profile',
  },
  manager: {
    qr: '/manager/qr',
  },
} as const;

/** Landing route for a given role after login. */
export function homePathForRole(role: Role | null): string {
  switch (role) {
    case 'superadmin':
    case 'admin':
      return ROUTES.admin.dashboard;
    case 'manager':
      return ROUTES.manager.qr;
    case 'member':
      return ROUTES.member.home;
    default:
      return ROUTES.login;
  }
}
