"use client";

import * as React from "react";

export type PaginationState<T> = {
  /** Items belonging to the current page. */
  pageItems: T[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalItems: number;
  /** 1-based index of the first item shown (0 when the list is empty). */
  fromItem: number;
  /** 1-based index of the last item shown. */
  toItem: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  previousPage: () => void;
};

/**
 * Client-side pagination over an array that is already in memory. Purely a
 * presentation concern - it never fetches or filters, it only slices.
 */
export function usePagination<T>(
  items: T[],
  initialPageSize = 10,
): PaginationState<T> {
  const [page, setPageRaw] = React.useState(1);
  const [pageSize, setPageSizeRaw] = React.useState(initialPageSize);

  const totalItems = items.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));

  // Keep the page in range when the underlying list shrinks - filtering,
  // refetching after an action, or changing the page size.
  const safePage = Math.min(page, pageCount);
  React.useEffect(() => {
    if (page > pageCount) {
      setPageRaw(pageCount);
    }
  }, [page, pageCount]);

  const pageItems = React.useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  const setPage = React.useCallback(
    (next: number) => {
      setPageRaw(Math.min(Math.max(1, next), pageCount));
    },
    [pageCount],
  );

  const setPageSize = React.useCallback((size: number) => {
    setPageSizeRaw(size);
    setPageRaw(1);
  }, []);

  return {
    pageItems,
    page: safePage,
    pageSize,
    pageCount,
    totalItems,
    fromItem: totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1,
    toItem: Math.min(safePage * pageSize, totalItems),
    canPreviousPage: safePage > 1,
    canNextPage: safePage < pageCount,
    setPage,
    setPageSize,
    nextPage: () => setPage(safePage + 1),
    previousPage: () => setPage(safePage - 1),
  };
}

/**
 * Page numbers to render, with `null` marking an ellipsis gap.
 * Always shows the first and last page plus a window around the current one.
 */
export function buildPageRange(
  page: number,
  pageCount: number,
  siblings = 1,
): (number | null)[] {
  const maxSlots = siblings * 2 + 5;
  if (pageCount <= maxSlots) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, pageCount);
  const showLeftGap = left > 2;
  const showRightGap = right < pageCount - 1;

  const range: (number | null)[] = [1];
  if (showLeftGap) range.push(null);

  const start = showLeftGap ? left : 2;
  const end = showRightGap ? right : pageCount - 1;
  for (let i = start; i <= end; i += 1) {
    range.push(i);
  }

  if (showRightGap) range.push(null);
  range.push(pageCount);

  return range;
}
