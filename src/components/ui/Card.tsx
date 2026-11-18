// Cards: white r24 + shadow-1. `press` adds hover-lift / press-sink; CardHeader = soft gradient strip.
import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

export function Card({ press, className = "", ...rest }: ComponentProps<"div"> & { press?: boolean }) {
  return <div className={`card ${press ? "card-press" : ""} ${className}`} {...rest} />;
}

export function LinkCard({ className = "", ...rest }: ComponentProps<typeof Link>) {
  return <Link className={`card card-press no-underline ${className}`} {...rest} />;
}

/** Soft gradient header: accent colour → slightly lighter, with a white sheen. */
export function CardHeader({ color = "var(--color-blue)", className = "", children, style }: { color?: string; className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={`card-head ${className}`} style={{ ["--hd" as string]: color, ...style }}>
      {children}
    </div>
  );
}

/** Rounded-square icon tile in an accent colour with a 3D bottom edge — one icon style everywhere. */
export function IconTile({ color = "var(--color-blue)", size = 48, children, className = "" }: { color?: string; size?: number; children: ReactNode; className?: string }) {
  return (
    <span className={`icon-tile ${className}`} style={{ ["--tile" as string]: color, width: size, height: size, borderRadius: size >= 44 ? 16 : 12 }} aria-hidden>
      {children}
    </span>
  );
}
