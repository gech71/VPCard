import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

type TableSkeletonProps = {
  rows?: number;
  columns: number;
  /** Optional per-column width classes, applied by column index. */
  widths?: string[];
};

/** Loading rows that preserve a table layout instead of collapsing it. */
export default function TableSkeleton({
  rows = 5,
  columns,
  widths,
}: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton
                className={widths?.[colIndex] ?? "h-4 w-full max-w-[10rem]"}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
