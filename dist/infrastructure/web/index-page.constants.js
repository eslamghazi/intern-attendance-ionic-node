/**
 * Where a preview crawler fetches the organisation's logo from — absolute
 * on the way out (the index page prefixes the request's origin). Served by
 * SettingsController.getBrandingLogo; the app's own icon when Settings has
 * no logo, so a preview always has a picture.
 */
export const BRANDING_LOGO_PATH = '/api/v1/settings/branding/logo.png';
/** How long the index page remembers the organisation's name and logo. */
export const BRANDING_TTL_MS = 60_000;
/** The picture a preview shows when Settings has no logo. */
export const BRANDING_FALLBACK_ICON = 'icon-512.png';
//# sourceMappingURL=index-page.constants.js.map