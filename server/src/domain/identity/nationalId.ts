// Egyptian national-ID parsing. Ported verbatim from
// supabase/functions/_shared/mod.ts — the derived date-of-birth password is the
// default credential for every new account, so any change here silently locks
// people out.
export interface ParsedNationalId {
  valid: boolean;
  /** ddmmyyyy — the default password for a freshly created account. */
  dobPassword?: string;
}

export function parseNationalId(input: string): ParsedNationalId {
  const s = (input || '').trim();
  if (!/^\d{14}$/.test(s)) return { valid: false };
  const century = s[0] === '2' ? 1900 : s[0] === '3' ? 2000 : null;
  if (century === null) return { valid: false };
  const yy = Number(s.slice(1, 3));
  const mm = Number(s.slice(3, 5));
  const dd = Number(s.slice(5, 7));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { valid: false };
  const year = century + yy;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { valid: true, dobPassword: `${pad(dd)}${pad(mm)}${year}` };
}

export function isValidNationalId(input: string): boolean {
  return parseNationalId(input).valid;
}
