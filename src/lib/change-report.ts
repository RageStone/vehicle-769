import type { Inspection, Vehicle } from "./types";
import { CHECK_ITEMS, FIT_LABELS, STATUS_LABEL } from "./types";
import { baseStatus, formatDate } from "./format";

export interface NoteChange {
  vehicle_id: string;
  old_notes: string | null;
  new_notes: string | null;
  changed_at: string;
}

export type ChangeType = "all" | "inspections" | "notes";
export type ResultFilter = "all" | "problems" | "recovered";

export interface ReportFilters {
  from: string; // YYYY-MM-DD
  to: string;
  category: string; // "all" or name
  type: ChangeType;
  result: ResultFilter;
  vehicleNumber: string;
}

export const H = {
  date: "תאריך",
  kind: "סוג שינוי",
  category: "קטגוריה",
  number: "מספר רכב",
  statusBefore: "סטטוס לפני",
  statusAfter: "סטטוס אחרי",
  notesBefore: "הערות לפני",
  notesAfter: "הערות אחרי",
};
const KIND_INSPECTION = "בדיקה";
const KIND_NOTES = "עדכון הערות רכב";
const NONE = "—";

const fieldsFor = () => [
  ...CHECK_ITEMS.map((c) => ({ key: c.key, label: c.label, ok: c.okLabel, bad: c.badLabel })),
  { key: "fit_ok" as const, label: FIT_LABELS.label, ok: FIT_LABELS.okLabel, bad: FIT_LABELS.badLabel },
];

export function reportHeaders(): string[] {
  const f = fieldsFor().flatMap((x) => [`${x.label} לפני`, `${x.label} אחרי`]);
  return [H.date, H.kind, H.category, H.number, H.statusBefore, H.statusAfter, ...f, H.notesBefore, H.notesAfter];
}

const inRange = (day: string, f: ReportFilters) => (!f.from || day >= f.from) && (!f.to || day <= f.to);

export function buildChangeReport(
  vehicles: Vehicle[],
  inspections: Inspection[],
  notes: NoteChange[],
  f: ReportFilters,
): Array<Record<string, string>> {
  const vmap = new Map(vehicles.map((v) => [v.id, v]));
  const q = f.vehicleNumber.trim();
  const vehicleOk = (v: Vehicle | undefined): v is Vehicle =>
    !!v && (f.category === "all" || v.category === f.category) && (!q || v.vehicle_number.includes(q));
  const fields = fieldsFor();
  const rows: Array<{ sort: string; row: Record<string, string> }> = [];

  if (f.type !== "notes") {
    const byVehicle = new Map<string, Inspection[]>();
    for (const i of inspections) {
      const arr = byVehicle.get(i.vehicle_id) ?? [];
      arr.push(i);
      byVehicle.set(i.vehicle_id, arr);
    }
    for (const [vid, list] of byVehicle) {
      const v = vmap.get(vid);
      if (!vehicleOk(v)) continue;
      list.sort((a, b) => (a.inspection_date + a.created_at).localeCompare(b.inspection_date + b.created_at));
      list.forEach((cur, idx) => {
        if (!inRange(cur.inspection_date, f)) return;
        const prev = idx > 0 ? list[idx - 1] : null;
        const after = baseStatus(cur);
        const before = prev ? baseStatus(prev) : null;
        if (f.result === "problems" && after !== "not_ok" && after !== "unfit") return;
        if (f.result === "recovered" && !(after === "ok" && (before === "not_ok" || before === "unfit"))) return;
        const row: Record<string, string> = {
          [H.date]: formatDate(cur.inspection_date),
          [H.kind]: KIND_INSPECTION,
          [H.category]: v.category,
          [H.number]: v.vehicle_number,
          [H.statusBefore]: before ? STATUS_LABEL[before] : NONE,
          [H.statusAfter]: STATUS_LABEL[after],
          [H.notesBefore]: prev?.notes ?? "",
          [H.notesAfter]: cur.notes ?? "",
        };
        const val = (i: Inspection | null, x: (typeof fields)[number]) => {
          const b = i?.[x.key];
          return b == null ? NONE : b ? x.ok : x.bad;
        };
        for (const x of fields) {
          row[`${x.label} לפני`] = val(prev, x);
          row[`${x.label} אחרי`] = val(cur, x);
        }
        rows.push({ sort: cur.inspection_date + cur.created_at, row });
      });
    }
  }

  if (f.type !== "inspections" && f.result === "all") {
    for (const n of notes) {
      const day = n.changed_at.slice(0, 10);
      if (!inRange(day, f)) continue;
      const v = vmap.get(n.vehicle_id);
      if (!vehicleOk(v)) continue;
      const row: Record<string, string> = {
        [H.date]: formatDate(day),
        [H.kind]: KIND_NOTES,
        [H.category]: v.category,
        [H.number]: v.vehicle_number,
        [H.notesBefore]: n.old_notes ?? "",
        [H.notesAfter]: n.new_notes ?? "",
      };
      rows.push({ sort: n.changed_at, row });
    }
  }

  return rows.sort((a, b) => a.sort.localeCompare(b.sort)).map((r) => r.row);
}
