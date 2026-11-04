import type { InspectionStatus } from "./types";

export function inspectionStatus(checks: {
  radio_ok: boolean;
  shov_ok: boolean;
  winter_ok: boolean;
  fit_ok: boolean;
}): InspectionStatus {
  if (!checks.fit_ok) return "unfit";
  return checks.radio_ok && checks.shov_ok && checks.winter_ok ? "ok" : "not_ok";
}