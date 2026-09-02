// Organization branding — a customer-configurable name + logo that shows in the
// app and on every exported document. Falls back to the app vendor (Calaix) when
// the org hasn't set its own, so the app is generic for any organization.
// Read via a PUBLIC rpc so the login screen can show it before sign-in without
// exposing the rest of app_settings.
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api/http';
import { CALAIX } from './config';
import { qk } from './api/keys';
import { applyTerminology, TERMINOLOGIES, type Terminology } from './terminology';

export interface Brand {
  name: string;
  logo: string; // a data URL (uploaded) or a public path (vendor fallback)
  hasOrg: boolean; // true when the org set its own name/logo
  memberPhotos: boolean; // whether member profile photos are enabled
}

interface BrandingRow {
  org_name: string | null;
  org_logo_url: string | null;
  terminology: string | null;
  member_photos: boolean | null;
}

/** Fetch just the org name + logo (public — works signed-out). */
export async function getBranding(): Promise<BrandingRow | null> {
  // A failure here must not blank the login screen: brandFrom() falls back to
  // the vendor default, which is exactly what an unbranded install shows.
  try {
    return (await apiFetch<BrandingRow>('/settings/branding')) ?? null;
  } catch {
    return null;
  }
}

/** Resolve branding from a row (fallback to the vendor default). */
export function brandFrom(s?: BrandingRow | null): Brand {
  const name = s?.org_name?.trim();
  const logo = s?.org_logo_url?.trim();
  return {
    name: name || CALAIX.name,
    logo: logo || CALAIX.logo,
    hasOrg: !!(name || logo),
    memberPhotos: s?.member_photos !== false, // default on
  };
}

/** React hook: the current organization branding (reactive to settings). */
export function useBranding(): Brand {
  const { data } = useQuery({ queryKey: qk.branding, queryFn: getBranding });
  return brandFrom(data);
}

/** Apply the org's terminology preset app-wide once branding loads. Mount once. */
export function useApplyTerminology(): void {
  const { data } = useQuery({ queryKey: qk.branding, queryFn: getBranding });
  const term = data?.terminology as Terminology | undefined;
  useEffect(() => {
    applyTerminology(term && (TERMINOLOGIES as readonly string[]).includes(term) ? term : 'generic');
  }, [term]);
}
