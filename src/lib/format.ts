export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

export const VALIDITY_DAYS = 7;

import type { Inspection, DisplayStatus } from "./types";

export function effectiveStatus(last: Inspection | null | undefined): DisplayStatus | null {
  if (!last) return null;
  if (last.fit_ok === false) return "unfit";
  const age = daysSince(last.inspection_date) ?? 0;
  if (last.status === "ok" && age > VALIDITY_DAYS) return "expired";
  return last.status;
}
export function baseStatus(last: Inspection): Inspection["status"] {
  return last.fit_ok === false ? "unfit" : last.status;
}
