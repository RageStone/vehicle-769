import { describe, it } from "node:test";
import { strictEqual } from "node:assert";
import { inspectionStatus } from "./inspection-status";

describe("inspection status", () => {
  it("unfit overrides all three successful checks", () => {
    strictEqual(inspectionStatus({ radio_ok: true, shov_ok: true, winter_ok: true, fit_ok: false }), "unfit");
  });
  it("unfit overrides failed checks", () => {
    strictEqual(inspectionStatus({ radio_ok: false, shov_ok: false, winter_ok: false, fit_ok: false }), "unfit");
  });
  it("all three successful checks and fit means ok", () => {
    strictEqual(inspectionStatus({ radio_ok: true, shov_ok: true, winter_ok: true, fit_ok: true }), "ok");
  });
  it("any failed check in a fit vehicle means not ok", () => {
    for (const key of ["radio_ok", "shov_ok", "winter_ok"] as const) {
      strictEqual(inspectionStatus({ radio_ok: true, shov_ok: true, winter_ok: true, fit_ok: true, [key]: false }), "not_ok");
    }
  });
});