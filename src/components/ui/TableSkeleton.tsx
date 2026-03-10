import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export default function TableSkeleton({ rows = 5, cols = 4 }: TableSkeletonProps) {
  return (
    <div className="border border-border">
      {/* Header */}
      <div className="flex gap-4 p-3 bg-secondary">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 p-3 border-t border-border">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
