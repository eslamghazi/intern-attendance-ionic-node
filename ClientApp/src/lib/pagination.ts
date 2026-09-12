// Shared, app-wide pagination. One source of truth for page size + the paging
// state hook, used by every server-paged admin grid so they behave identically.
import { useEffect, useState, type DependencyList } from 'react';
import { MAX_PAGE_SIZE, PAGE_SIZE } from './config';

export { PAGE_SIZE, MAX_PAGE_SIZE };

export interface Pagination {
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  /** Inclusive row range for the current page. */
  from: number;
  to: number;
  /** Total page count for a given server row count. */
  pagesFor: (total: number) => number;
}

/**
 * Client paging state for a server-paged list. Call this BEFORE the query so
 * `page` can go into the query key; then derive the page count with
 * `pagesFor(total)` once the server returns the total.
 * - `resetDeps`: when any of these change (search / filters), jump to page 1.
 * - `pageSize` : defaults to the app-wide PAGE_SIZE.
 */
export function usePagination(
  resetDeps: DependencyList = [],
  pageSize: number = PAGE_SIZE,
): Pagination {
  const [page, setPage] = useState(1);

  // Reset to the first page whenever the query inputs change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), resetDeps);

  const from = (page - 1) * pageSize;
  return {
    page,
    setPage,
    pageSize,
    from,
    to: from + pageSize - 1,
    pagesFor: (total: number) => Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Every page of a listing, in order.
 *
 * For the screens that genuinely need a whole month at once — the roster grid
 * and the attendance matrix both compute column totals over every member the
 * filters match, not over the twelve rows on display.
 *
 * They used to do that by asking for a single 5000-row page, which meant the
 * server had to allow a page that large, which meant `page_size` no longer meant
 * anything. Looping keeps the cap honest: a page is a page, and "all of it" is
 * spelled out here, once.
 *
 * STOPS ON A SHORT PAGE as well as on the count. A row deleted between two
 * requests lowers `total` and would otherwise leave this asking for a page that
 * no longer exists, forever.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ rows: T[]; total: number }>,
): Promise<{ rows: T[]; total: number }> {
  const out: T[] = [];
  let total = 0;

  for (let page = 1; ; page++) {
    const res = await fetchPage(page, MAX_PAGE_SIZE);
    out.push(...res.rows);
    total = res.total;
    if (res.rows.length < MAX_PAGE_SIZE || out.length >= total) break;
  }

  return { rows: out, total };
}
