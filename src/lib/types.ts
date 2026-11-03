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
  radio_ok: boolean | null;
  shov_ok: boolean | null;
  winter_ok: boolean | null;
  fit_ok: boolean | null;
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
export type CheckKey = "radio_ok" | "shov_ok" | "winter_ok" | "fit_ok";
export interface CheckItem {
  key: CheckKey;
  label: string;
  okLabel: string;
  badLabel: string;
}
export const CHECK_ITEMS: CheckItem[] = [
  { key: "radio_ok", label: "רדיו", okLabel: "תקין", badLabel: "לא תקין" },
  { key: "shov_ok", label: "שוב", okLabel: "תקין", badLabel: "לא תקין" },
  { key: "winter_ok", label: "טיפול חורף", okLabel: "תקין", badLabel: "לא תקין" },
  { key: "fit_ok", label: "כשיר", okLabel: "כשיר", badLabel: "לא כשיר" },
];
