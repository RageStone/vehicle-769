import { it } from "node:test";
import { strictEqual } from "node:assert";
import { daysSince, effectiveStatus } from "./format";
import type { Inspection } from "./types";
it("date-only overdue ages compare local calendar days", () => {
  const d = new Date();
  d.setDate(d.getDate() - 8);
  const iso = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
  strictEqual(daysSince(iso), 8);
  const inspection = { inspection_date: iso, status: "ok", fit_ok: true } as Inspection;
  strictEqual(effectiveStatus(inspection, 7), "expired");
  strictEqual(effectiveStatus(inspection, 14), "ok");
});
