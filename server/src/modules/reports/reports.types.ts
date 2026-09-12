// The shapes the reports module passes between its layers.

import type { AttendanceHistoryEntryDto } from './dto/reports.dto.js';

/**
 * A history row before the outcome is worked out.
 *
 * The repository reads the columns; the SERVICE pairs arrival with departure
 * into the single `outcome` the screens and the exports render from. The
 * interface used to promise `AttendanceHistoryEntryDto[]` from the repository —
 * a shape it has never produced, because that field does not exist until the
 * service adds it.
 */
export type AttendanceHistoryRow = Omit<AttendanceHistoryEntryDto, 'outcome'>;
