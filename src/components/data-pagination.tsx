"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildPageRange, type PaginationState } from "@/hooks/use-pagination";
import { cn } from "@/lib/utils";

type DataPaginationProps = {
  pagination: PaginationState<any>;
  /** Noun used in the summary line, e.g. "requests". */
  itemLabel?: string;
  /** Offer a rows-per-page control. Pass a single-entry array to hide it. */
  pageSizeOptions?: number[];
  className?: string;
};

/** Footer control bar for any client-paginated table or list. */
export default function DataPagination({
  pagination,
  itemLabel = "results",
  pageSizeOptions = [10, 25, 50],
  className,
}: DataPaginationProps) {
  const {
    page,
    pageCount,
    pageSize,
    totalItems,
    fromItem,
    toItem,
    canNextPage,
    canPreviousPage,
    setPage,
    setPageSize,
    nextPage,
    previousPage,
  } = pagination;

  if (totalItems === 0) return null;

  const pages = buildPageRange(page, pageCount);
  const showPageSize =
    pageSizeOptions.length > 1 && totalItems > pageSizeOptions[0];

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-medium tabular-nums text-foreground">
            {fromItem}&ndash;{toItem}
          </span>{" "}
          of{" "}
          <span className="font-medium tabular-nums text-foreground">
            {totalItems}
          </span>{" "}
          {itemLabel}
        </p>

        {showPageSize ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger
                className="h-8 w-[4.75rem]"
                aria-label="Rows per page"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {pageCount > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-1 sm:justify-end"
        >
          <Button
            variant="outline"
            size="icon-sm"
            onClick={previousPage}
            disabled={!canPreviousPage}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>

          <div className="flex items-center gap-1">
            {pages.map((entry, index) =>
              entry === null ? (
                <span
                  key={`gap-${index}`}
                  aria-hidden="true"
                  className="px-1 text-sm text-muted-foreground"
                >
                  &hellip;
                </span>
              ) : (
                <Button
                  key={entry}
                  variant={entry === page ? "default" : "ghost"}
                  size="icon-sm"
                  onClick={() => setPage(entry)}
                  aria-label={`Page ${entry}`}
                  aria-current={entry === page ? "page" : undefined}
                  className="tabular-nums"
                >
                  {entry}
                </Button>
              ),
            )}
          </div>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={nextPage}
            disabled={!canNextPage}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
