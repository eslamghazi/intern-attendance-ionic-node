// Shared, app-wide pagination. One source of truth for page size + the paging
// state hook, used by every server-paged admin grid so they behave identically.
import { useEffect, useState } from 'react';
import { PAGE_SIZE, REPORT_PAGE_SIZE } from './config';

export { PAGE_SIZE, REPORT_PAGE_SIZE };

export interface Pagination {
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  /** PostgREST range for the current page: `.range(from, to)`. */
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
  resetDeps: unknown[] = [],
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
