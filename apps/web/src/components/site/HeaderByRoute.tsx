"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Both header variants are rendered on the server by the layout (<SiteHeader/> stays the single source);
 * this tiny client wrapper only picks which one to show: overlay on "/", light elsewhere.
 */
export function HeaderByRoute({ overlay, light }: { overlay: ReactNode; light: ReactNode }) {
  return usePathname() === "/" ? overlay : light;
}
