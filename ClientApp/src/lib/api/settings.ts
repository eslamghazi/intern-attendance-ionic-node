// Generic, app-wide settings access. The app keeps a single global settings row
// (app_settings.id = 1) that applies to every branch and member. A typed field
// descriptor drives the SettingsPage UI so new settings can be added in one
// place.
import { apiFetch } from './http';
import type { AppSettings } from '../types';

/** Superadmin sets (or clears, with an empty string) the master password that
 *  can open any account. Stored hashed server-side. */
export async function setMasterPassword(pw: string): Promise<void> {
  await apiFetch('/settings/master-password', { method: 'PUT', body: { password: pw } });
}

/** Whether a master password is currently configured. */
export async function masterPasswordIsSet(): Promise<boolean> {
  const { configured } = await apiFetch<{ configured: boolean }>('/settings/master-password');
  return configured;
}

export async function getSettings(): Promise<AppSettings | null> {
  // Null is a legitimate answer, not an error. The endpoint is public and
  // answers null rather than 401 when no caller is attached, so a request that
  // lands before the token does gets null and callers fall back to defaults —
  // which is what lets the sign-in screen render branding before anyone signs
  // in.
  return (await apiFetch<AppSettings | null>('/settings')) ?? null;
}

/** The only columns a client may write. Mirrored — and enforced — server-side,
 *  because app_settings also holds the master password hash and the shift
 *  defaults the attendance recorder trusts. */
const EDITABLE_FIELDS = [
  'face_match_threshold',
  'liveness_required',
  'liveness_mode',
  'default_radius_meters',
  'max_accuracy_meters',
  'late_grace_minutes',
  'require_play_integrity',
  'bypass_face',
  'bypass_location',
  'store_face_images',
  'store_probe_images',
  'qr_requires_member',
  'qr_allow_image',
  'qr_validity_seconds',
  'qr_bypass_minutes',
  'enforce_shift_window',
  'auto_leave_work',
  'bypass_checkout_window',
  'capture_hold_seconds',
  'org_name',
  'org_logo_url',
  'terminology',
  'member_photos',
  'show_out_of_range_map',
  'block_dev_options',
  'location_ip_max_km',
  'web_detect_frozen_gps',
  'checkin_method',
] as const;

/** The settings a client is allowed to send back. */
export type EditableSetting = (typeof EDITABLE_FIELDS)[number];

export async function updateSettings(s: AppSettings): Promise<void> {
  const body: Partial<Pick<AppSettings, EditableSetting>> = {};
  for (const k of EDITABLE_FIELDS) Object.assign(body, { [k]: s[k] });
  await apiFetch('/settings', { method: 'PATCH', body });
}

export type SettingKind = 'number' | 'time' | 'toggle' | 'select';
/** Tab a setting belongs to on the Settings screen. */
export type SettingGroup = 'face' | 'location' | 'qr' | 'shifts';

/** The setting tabs, in order (the "org" branding tab is added by the page). */
export const SETTING_GROUPS: { key: SettingGroup; labelKey: string }[] = [
  { key: 'face', labelKey: 'admin.groupFace' },
  { key: 'location', labelKey: 'admin.groupLocation' },
  { key: 'qr', labelKey: 'admin.groupQr' },
  { key: 'shifts', labelKey: 'admin.groupShifts' },
];

/** Generic descriptor of one editable setting, used to render the form. */
export interface SettingField {
  key: keyof AppSettings;
  kind: SettingKind;
  group: SettingGroup;
  labelKey: string;
  step?: string;
  /** Options for a 'select' field: value + its i18n label key. */
  options?: { value: string; labelKey: string }[];
  /** Translation key for the help text shown under the field. */
  descKey: string;
}

export const SETTING_FIELDS: SettingField[] = [
  { key: 'face_match_threshold', kind: 'number', group: 'face', labelKey: 'admin.faceThreshold', step: '0.01', descKey: 'settingsDesc.faceThreshold' },
  { key: 'liveness_required', kind: 'toggle', group: 'face', labelKey: 'admin.livenessRequired', descKey: 'settingsDesc.livenessRequired' },
  {
    key: 'liveness_mode',
    kind: 'select',
    group: 'face',
    labelKey: 'admin.livenessMode',
    descKey: 'settingsDesc.livenessMode',
    options: [
      { value: 'turn', labelKey: 'admin.livenessModeTurn' },
      { value: 'action', labelKey: 'admin.livenessModeAction' },
      { value: 'both', labelKey: 'admin.livenessModeBoth' },
    ],
  },
  { key: 'capture_hold_seconds', kind: 'number', group: 'face', labelKey: 'admin.captureHoldSeconds', descKey: 'settingsDesc.captureHoldSeconds' },
  { key: 'require_play_integrity', kind: 'toggle', group: 'face', labelKey: 'admin.requireIntegrity', descKey: 'settingsDesc.requireIntegrity' },
  { key: 'bypass_face', kind: 'toggle', group: 'face', labelKey: 'admin.bypassFace', descKey: 'settingsDesc.bypassFace' },
  { key: 'store_face_images', kind: 'toggle', group: 'face', labelKey: 'admin.storeFaceImages', descKey: 'settingsDesc.storeFaceImages' },
  { key: 'store_probe_images', kind: 'toggle', group: 'face', labelKey: 'admin.storeProbeImages', descKey: 'settingsDesc.storeProbeImages' },
  {
    key: 'checkin_method',
    kind: 'select',
    group: 'location',
    labelKey: 'admin.checkinMethod',
    descKey: 'settingsDesc.checkinMethod',
    options: [
      { value: 'both', labelKey: 'admin.checkinMethodBoth' },
      { value: 'location', labelKey: 'admin.checkinMethodLocation' },
      { value: 'qr', labelKey: 'admin.checkinMethodQr' },
      { value: 'none', labelKey: 'admin.checkinMethodNone' },
    ],
  },
  { key: 'default_radius_meters', kind: 'number', group: 'location', labelKey: 'admin.defaultRadius', descKey: 'settingsDesc.defaultRadius' },
  { key: 'max_accuracy_meters', kind: 'number', group: 'location', labelKey: 'admin.maxAccuracy', descKey: 'settingsDesc.maxAccuracy' },
  { key: 'bypass_location', kind: 'toggle', group: 'location', labelKey: 'admin.bypassLocation', descKey: 'settingsDesc.bypassLocation' },
  { key: 'show_out_of_range_map', kind: 'toggle', group: 'location', labelKey: 'admin.showRangeMap', descKey: 'settingsDesc.showRangeMap' },
  { key: 'block_dev_options', kind: 'toggle', group: 'location', labelKey: 'admin.blockDevOptions', descKey: 'settingsDesc.blockDevOptions' },
  { key: 'location_ip_max_km', kind: 'number', group: 'location', labelKey: 'admin.ipMaxKm', descKey: 'settingsDesc.ipMaxKm' },
  { key: 'web_detect_frozen_gps', kind: 'toggle', group: 'location', labelKey: 'admin.webFrozenGps', descKey: 'settingsDesc.webFrozenGps' },
  { key: 'qr_requires_member', kind: 'toggle', group: 'qr', labelKey: 'admin.qrRequiresMember', descKey: 'settingsDesc.qrRequiresMember' },
  { key: 'qr_allow_image', kind: 'toggle', group: 'qr', labelKey: 'admin.qrAllowImage', descKey: 'settingsDesc.qrAllowImage' },
  { key: 'qr_validity_seconds', kind: 'number', group: 'qr', labelKey: 'admin.qrValidity', descKey: 'settingsDesc.qrValidity' },
  { key: 'qr_bypass_minutes', kind: 'number', group: 'qr', labelKey: 'admin.qrBypassMinutes', descKey: 'settingsDesc.qrBypassMinutes' },
  { key: 'enforce_shift_window', kind: 'toggle', group: 'shifts', labelKey: 'admin.enforceShiftWindow', descKey: 'settingsDesc.enforceShiftWindow' },
  { key: 'bypass_checkout_window', kind: 'toggle', group: 'shifts', labelKey: 'admin.bypassCheckoutWindow', descKey: 'settingsDesc.bypassCheckoutWindow' },
  { key: 'auto_leave_work', kind: 'toggle', group: 'shifts', labelKey: 'admin.autoLeaveWork', descKey: 'settingsDesc.autoLeaveWork' },
];
