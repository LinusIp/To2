// Skeleton loaders: shimmering placeholders instead of blank screens (static under reduced motion).
import type { CSSProperties } from "react";
import { ui } from "@/i18n/uz-ui";

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}

/** A page-shaped skeleton: header card + N list rows. */
export function SkeletonPage({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4 px-[18px] pt-4 pb-8 md:px-2" role="status" aria-label={ui.loading}>
      <div className="card flex flex-col gap-3 p-4">
        <div className="flex gap-3">
          <Skeleton className="h-16 flex-1" />
          <Skeleton className="h-16 flex-1" />
        </div>
        <Skeleton className="h-3 w-full !rounded-full" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card flex items-center gap-3.5 p-3.5">
          <Skeleton className="h-12 w-12 flex-none" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-2.5 w-full !rounded-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">{ui.loading}</span>
    </div>
  );
}
