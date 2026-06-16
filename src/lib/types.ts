export type InspectionStatus = "ok" | "not_ok" | "not_checked";
export type DisplayStatus = InspectionStatus | "expired";

export interface Vehicle {
  id: string;
  category: string;
  vehicle_number: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inspection {
  id: string;
  vehicle_id: string;
  inspection_date: string;
  status: InspectionStatus;
  notes: string | null;
  created_at: string;
}

export interface VehicleWithLast extends Vehicle {
  last_inspection: Inspection | null;
}

export const STATUS_LABEL: Record<InspectionStatus, string> = {
  ok: "תקין",
  not_ok: "לא תקין",
  not_checked: "לא נבדק",
};

export const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  ok: "תקין",
  not_ok: "לא תקין",
  not_checked: "לא נבדק",
  expired: "פג תוקף",
};