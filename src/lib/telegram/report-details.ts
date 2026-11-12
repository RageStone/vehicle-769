import type { Json } from "../../integrations/supabase/types";
export type Snapshot = Record<string, Json | undefined>;
export const snapshot = (value: Json | undefined): Snapshot | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;
export function reportVehicle(snapshotValue: Json | undefined) {
  const v = snapshot(snapshotValue);
  return {
    number: typeof v?.vehicle_number === "string" ? v.vehicle_number : "",
    name: [v?.category, v?.notes].filter((x) => typeof x === "string" && x.trim()).join(" · "),
  };
}
export function valueForField(value: Json | undefined, field: string): Json | undefined {
  const v = snapshot(value);
  return field === "status" && v?.fit_ok === false ? "unfit" : v?.[field];
}
export interface HistoricalInspection {
  id: string;
  vehicle_id: string;
  user_id: string | null;
  created_at: string;
  inspection_date: string;
  [key: string]: unknown;
}
// Legacy insert audits stored SQL NULL rather than the previous vehicle inspection.
// Only reconstruct from the same owner's records that existed before this event.
export function previousInspection(
  inspections: HistoricalInspection[],
  vehicleId: string,
  userId: string,
  occurredAt: string,
  currentId: Json | undefined,
): Snapshot | null {
  const candidates = inspections.filter(
    (i) =>
      i.vehicle_id === vehicleId &&
      i.user_id === userId &&
      i.id !== currentId &&
      Date.parse(i.created_at) < Date.parse(occurredAt),
  );
  candidates.sort(
    (a, b) =>
      b.inspection_date.localeCompare(a.inspection_date) ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  );
  return candidates[0] ? (JSON.parse(JSON.stringify(candidates[0])) as Snapshot) : null;
}
