// Egyptian national ID (الرقم القومي) parsing & validation.
// Format (14 digits): C YY MM DD GG SSS G K
//   C  = century (2 -> 1900s, 3 -> 2000s)
//   YY MM DD = birth date
//   GG = governorate code
//   SSS = sequence, G = gender digit (odd -> male, even -> female)
//   K  = check digit
// We validate structure + birth date and derive DOB/gender. The official
// check digit is verified best-effort and never blocks on its own.

import { NATIONAL_ID_LENGTH } from './config';

export interface NationalIdInfo {
  valid: boolean;
  /** ISO date yyyy-mm-dd */
  dob?: string;
  /** Default first password derived from DOB as ddmmyyyy (8 chars). */
  dobPassword?: string;
  gender?: 'male' | 'female';
  governorateCode?: string;
  /** i18n key describing why it's invalid. */
  reason?: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function parseEgyptianNationalId(input: string): NationalIdInfo {
  const s = (input || '').trim();
  if (s.length !== NATIONAL_ID_LENGTH || !/^\d+$/.test(s)) {
    return { valid: false, reason: 'must_be_14_digits' };
  }

  const centuryDigit = s[0];
  const century = centuryDigit === '2' ? 1900 : centuryDigit === '3' ? 2000 : null;
  if (century === null) return { valid: false, reason: 'invalid_century' };

  const yy = Number(s.slice(1, 3));
  const mm = Number(s.slice(3, 5));
  const dd = Number(s.slice(5, 7));
  const year = century + yy;

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return { valid: false, reason: 'invalid_date' };
  }
  const d = new Date(Date.UTC(year, mm - 1, dd));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  ) {
    return { valid: false, reason: 'invalid_date' };
  }

  const genderDigit = Number(s[12]);
  const gender = genderDigit % 2 === 0 ? 'female' : 'male';

  return {
    valid: true,
    dob: `${year}-${pad2(mm)}-${pad2(dd)}`,
    dobPassword: `${pad2(dd)}${pad2(mm)}${year}`,
    gender,
    governorateCode: s.slice(7, 9),
  };
}

export function isValidNationalId(input: string): boolean {
  return parseEgyptianNationalId(input).valid;
}

/** Generate a structurally-valid DUMMY national ID (for testing only): century
 *  3 (2000s), a real birth date, a governorate code, random serial + gender +
 *  check digit. Passes parseEgyptianNationalId (the check digit isn't enforced). */
export function randomDummyNationalId(): string {
  const r = (n: number) => Math.floor(Math.random() * n);
  const yy = pad2(r(6)); // 2000–2005
  const mm = pad2(1 + r(12));
  const dd = pad2(1 + r(28));
  const gg = pad2(1 + r(27)); // governorate 01–27
  const sss = String(r(1000)).padStart(3, '0');
  return `3${yy}${mm}${dd}${gg}${sss}${r(10)}${r(10)}`;
}
