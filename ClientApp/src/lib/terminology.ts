// App-wide terminology preset: the admin can make the app speak about
// "students", "employees", "intern students", … instead of the generic
// "members". We don't rewrite every i18n key by hand — we transform the loaded
// bundle's member/branch/group words (all forms) into the chosen preset's
// words. Some presets also rename the branch & group nouns (e.g. intern
// students → hospitals & batches). 'generic' keeps the originals.
import i18n from './i18n';
import ar from '../i18n/ar.json';
import en from '../i18n/en.json';

export const TERMINOLOGIES = ['generic', 'students', 'intern_students', 'employees'] as const;
export type Terminology = (typeof TERMINOLOGIES)[number];

// Ordered longest-first so definite/plural forms are replaced before the shorter
// ones they contain (الأعضاء before أعضاء, Members before Member, etc.).
const REPL: Record<Exclude<Terminology, 'generic'>, { en: [string, string][]; ar: [string, string][] }> = {
  students: {
    en: [
      ['Members', 'Students'],
      ['members', 'students'],
      ['Member', 'Student'],
      ['member', 'student'],
    ],
    ar: [
      ['الأعضاء', 'الطلاب'],
      ['العضو', 'الطالب'],
      ['أعضاء', 'طلاب'],
      ['عضو', 'طالب'],
    ],
  },
  employees: {
    en: [
      ['Members', 'Employees'],
      ['members', 'employees'],
      ['Member', 'Employee'],
      ['member', 'employee'],
    ],
    ar: [
      ['الأعضاء', 'الموظفين'],
      ['العضو', 'الموظف'],
      ['أعضاء', 'موظفين'],
      ['عضو', 'موظف'],
    ],
  },
  // Intern students also rename branches → hospitals and groups → batches.
  intern_students: {
    en: [
      ['Members', 'Interns'],
      ['members', 'interns'],
      ['Member', 'Intern'],
      ['member', 'intern'],
      ['Branches', 'Hospitals'],
      ['branches', 'hospitals'],
      ['Branch', 'Hospital'],
      ['branch', 'hospital'],
      ['Groups', 'Batches'],
      ['groups', 'batches'],
      ['Group', 'Batch'],
      ['group', 'batch'],
    ],
    ar: [
      ['الأعضاء', 'طلاب الامتياز'],
      ['العضو', 'طالب الامتياز'],
      ['أعضاء', 'طلاب امتياز'],
      ['عضو', 'طالب امتياز'],
      ['الفروع', 'المستشفيات'],
      ['الفرع', 'المستشفى'],
      ['فروع', 'مستشفيات'],
      ['فرعك', 'مستشفاك'],
      ['فرع', 'مستشفى'],
      ['المجموعات', 'الدفعات'],
      ['المجموعة', 'الدفعة'],
      ['مجموعتك', 'دفعتك'],
      ['مجموعات', 'دفعات'],
      ['مجموعة', 'دفعة'],
    ],
  },
};

function transform(node: unknown, repls: [string, string][]): unknown {
  if (typeof node === 'string') {
    let s = node;
    for (const [a, b] of repls) s = s.split(a).join(b);
    return s;
  }
  if (Array.isArray(node)) return node.map((n) => transform(n, repls));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(node as object)) {
      out[k] = transform((node as Record<string, unknown>)[k], repls);
    }
    return out;
  }
  return node;
}

let current: Terminology | null = null;

/** Swap the app's terminology preset. Safe to call repeatedly. */
export function applyTerminology(term: Terminology): void {
  if (term === current) return;
  current = term;
  if (term === 'generic') {
    i18n.addResourceBundle('en', 'translation', en, true, true);
    i18n.addResourceBundle('ar', 'translation', ar, true, true);
  } else {
    const r = REPL[term];
    i18n.addResourceBundle('en', 'translation', transform(en, r.en), true, true);
    i18n.addResourceBundle('ar', 'translation', transform(ar, r.ar), true, true);
  }
  // Re-render everything using useTranslation with the swapped resources.
  void i18n.changeLanguage(i18n.language);
}
