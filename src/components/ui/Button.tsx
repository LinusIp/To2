// Chunky 3D buttons (globals.css .btn*): solid bottom edge, press = sink into it. ≥ 48 px tall.
import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "green" | "white" | "soft" | "danger" | "default";

const cls = (variant: ButtonVariant, block?: boolean, extra?: string) =>
  ["btn", variant !== "default" && `btn-${variant}`, block && "w-full", extra].filter(Boolean).join(" ");

export function Button({ variant = "default", block, className, type = "button", ...rest }: ComponentProps<"button"> & { variant?: ButtonVariant; block?: boolean }) {
  return <button type={type} className={cls(variant, block, className)} {...rest} />;
}

export function LinkButton({ variant = "default", block, className, ...rest }: ComponentProps<typeof Link> & { variant?: ButtonVariant; block?: boolean }) {
  return <Link className={cls(variant, block, className)} {...rest} />;
}
