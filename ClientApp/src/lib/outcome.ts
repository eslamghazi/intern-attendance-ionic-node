/**
 * How each attendance outcome is shown.
 *
 * MIRRORS server/src/config/constants.ts ATTENDANCE_OUTCOME. The server decides
 * the outcome — pairing how a member arrived with how they left — and sends the
 * code; this decides how it looks. Both lists must hold the same keys, which
 * `outcome.test.ts` on the server and the legend below both depend on.
 *
 * The MARK is what makes the meaning survive: printed, photocopied, or read by
 * someone who cannot separate the greens from the reds. The colour is a glance,
 * the mark is the fact.
 */
export const OUTCOME_STYLE = {
  off: { mark: '–', fill: '#f3f4f6', fg: '#6b7280' },
  upcoming: { mark: '·', fill: '#dbeafe', fg: '#2563eb' },
  absent: { mark: '✗', fill: '#fee2e2', fg: '#dc2626' },
  present_open: { mark: '✓', fill: '#dcfce7', fg: '#16a34a' },
  present_out: { mark: '✓✓', fill: '#bbf7d0', fg: '#15803d' },
  present_early: { mark: '✓↩', fill: '#fef9c3', fg: '#b45309' },
  present_left: { mark: '✓⇥', fill: '#f3e8ff', fg: '#9333ea' },
  late_open: { mark: '!', fill: '#fef08a', fg: '#b45309' },
  late_out: { mark: '!✓', fill: '#fde68a', fg: '#b45309' },
  late_early: { mark: '!↩', fill: '#fed7aa', fg: '#c2410c' },
  late_left: { mark: '!⇥', fill: '#e9d5ff', fg: '#7e22ce' },
} as const;

export type Outcome = keyof typeof OUTCOME_STYLE;

/** Good first, then partial, then the failures. Same order as the server's. */
export const OUTCOME_ORDER: readonly Outcome[] = [
  'present_out',
  'present_open',
  'late_out',
  'late_open',
  'present_early',
  'late_early',
  'present_left',
  'late_left',
  'absent',
  'upcoming',
  'off',
];

/**
 * An outcome code as it arrives from the API.
 *
 * A string rather than `Outcome`, because the server is free to add a code this
 * build has never heard of: a client that types the field as the union it knows
 * is a client that will render a crash instead of a cell. Everything below
 * treats an unrecognised code as `off`.
 */
export type OutcomeCode = string | null | undefined;

export function isOutcome(value: OutcomeCode): value is Outcome {
  return typeof value === 'string' && value in OUTCOME_STYLE;
}

/** The style for an outcome, falling back to `off` for anything unrecognised. */
export function outcomeStyle(value: OutcomeCode) {
  return OUTCOME_STYLE[isOutcome(value) ? value : 'off'];
}

/** The i18n key for an outcome's label. */
export function outcomeLabelKey(value: OutcomeCode): string {
  return `outcome.${isOutcome(value) ? value : 'off'}`;
}
