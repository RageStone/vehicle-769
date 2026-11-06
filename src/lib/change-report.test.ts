import { describe, it } from "node:test";
import { strictEqual } from "node:assert";
const expect = (a: unknown) => ({ toBe: (b: unknown) => strictEqual(a, b), toHaveLength: (n: number) => strictEqual((a as unknown[]).length, n) });
import { buildChangeReport, H } from "./change-report";
import type { Inspection, Vehicle } from "./types";

const v: Vehicle = { id: "v1", category: "A", vehicle_number: "123", notes: null, created_at: "", updated_at: "" };
const ins = (id: string, date: string, ok: boolean): Inspection => ({
  id, vehicle_id: "v1", inspection_date: date, status: ok ? "ok" : "not_ok", notes: null,
  radio_ok: ok, shov_ok: true, winter_ok: true, fit_ok: true, created_at: date,
});
const base = { from: "2026-11-02", to: "2026-11-06", category: "all", type: "all" as const, result: "all" as const, vehicleNumber: "" };

describe("change report", () => {
  it("one row per inspection in range, with previous inspection as before", () => {
    const rows = buildChangeReport([v], [ins("a", "2026-11-01", false), ins("b", "2026-11-03", true)], [], base);
    expect(rows).toHaveLength(1);
    expect(rows[0][H.statusBefore]).toBe("לא תקין");
    expect(rows[0][H.statusAfter]).toBe("תקין");
  });
  it("recovered filter keeps only not_ok→ok", () => {
    const rows = buildChangeReport([v], [ins("a", "2026-11-03", true), ins("b", "2026-11-04", false)], [], { ...base, result: "recovered" });
    expect(rows).toHaveLength(0);
  });
  it("includes note changes in range", () => {
    const rows = buildChangeReport([v], [], [{ vehicle_id: "v1", old_notes: "x", new_notes: "y", changed_at: "2026-11-05T10:00:00Z" }], base);
    expect(rows[0][H.notesAfter]).toBe("y");
  });
});
