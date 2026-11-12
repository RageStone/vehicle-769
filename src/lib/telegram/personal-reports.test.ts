import { it } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { atIsraelHour, reportPeriod, nextDuePeriod, manualPeriod } from "./domain";
import { previousInspection, reportVehicle, valueForField } from "./report-details";
it("different users can have different due hours without changing Israel timezone", () => {
  strictEqual(
    nextDuePeriod("2026-11-12T05:00:00Z", undefined, new Date("2026-11-12T07:00:00Z"), 8)?.end,
    "2026-11-12T06:00:00.000Z",
  );
  strictEqual(
    nextDuePeriod("2026-11-12T05:00:00Z", undefined, new Date("2026-11-12T07:00:00Z"), 20),
    null,
  );
});
it("a skipped spring hour runs at the corresponding next valid hour", () => {
  strictEqual(atIsraelHour("2026-03-27", 2), "2026-03-27T00:00:00.000Z");
});
it("the repeated autumn hour has one deterministic daily boundary", () => {
  strictEqual(atIsraelHour("2026-10-25", 1), "2026-10-24T22:00:00.000Z");
});
it("changing report hour preserves the previous delivered boundary", () => {
  const period = nextDuePeriod(
    "2026-11-10T10:00:00Z",
    "2026-11-11T18:00:00.000Z",
    new Date("2026-11-12T20:00:00Z"),
    22,
    "2026-11-12T19:00:00.000Z",
  );
  strictEqual(period?.start, "2026-11-11T18:00:00.000Z");
  strictEqual(period?.end, "2026-11-12T20:00:00.000Z");
});
it("manual sending covers the current period only up to now", () => {
  deepStrictEqual(manualPeriod(new Date("2026-11-12T15:00:00Z"), 8), {
    start: "2026-11-12T06:00:00.000Z",
    end: "2026-11-12T15:00:00.000Z",
  });
  strictEqual(
    reportPeriod(new Date("2026-11-12T15:00:00Z"), true, 8).end,
    "2026-11-13T06:00:00.000Z",
  );
});
it("legacy before status uses the previous inspection from the same account and event time", () => {
  const rows = [
    {
      id: "old",
      vehicle_id: "v",
      user_id: "A",
      created_at: "2026-11-11T10:00:00Z",
      inspection_date: "2026-11-11",
      status: "unfit",
      fit_ok: false,
    },
    {
      id: "other",
      vehicle_id: "v",
      user_id: "B",
      created_at: "2026-11-11T11:00:00Z",
      inspection_date: "2026-11-11",
      status: "ok",
    },
    {
      id: "future",
      vehicle_id: "v",
      user_id: "A",
      created_at: "2026-11-13T10:00:00Z",
      inspection_date: "2026-11-13",
      status: "ok",
    },
  ];
  const before = previousInspection(rows, "v", "A", "2026-11-12T10:00:00Z", "current");
  strictEqual(before?.id, "old");
  strictEqual(valueForField(before, "status"), "unfit");
  strictEqual(previousInspection(rows, "absent", "A", "2026-11-12T10:00:00Z", "current"), null);
});
it("vehicle headings use actual number, category, and name/notes", () => {
  deepStrictEqual(reportVehicle({ vehicle_number: "12345", category: "טויוטה", notes: "רפואה" }), {
    number: "12345",
    name: "טויוטה · רפואה",
  });
  strictEqual(valueForField({ status: "ok", fit_ok: false }, "status"), "unfit");
});
