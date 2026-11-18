import type { ComponentProps } from "react";

/** Pill chip (globals.css .chip); `soft` = small tinted variant for tags. */
export function Chip({ soft, className = "", ...rest }: ComponentProps<"span"> & { soft?: boolean }) {
  return <span className={`chip ${soft ? "chip-soft" : ""} ${className}`} {...rest} />;
}
