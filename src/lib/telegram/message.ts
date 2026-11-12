import type { Json } from "../../integrations/supabase/types";
import { formatIsrael } from "./domain";
import { valueForField } from "./report-details";
export interface MessageEvent {
  vehicle_id: string;
  event_type: string;
  occurred_at: string;
  changed_fields: string[];
  before_values: Json | null;
  after_values: Json | null;
}
const fields: Record<string, string> = {
  status: "סטטוס",
  fit_ok: "כשירות",
  radio_ok: "רדיו",
  shov_ok: "שו״ב",
  winter_ok: "טיפול חורף",
  inspection_date: "תאריך בדיקה",
  notes: "הערות",
  vehicle_number: "מספר רכב",
  category: "שם / סוג רכב",
};
const kinds: Record<string, string> = {
  inspection_insert: "בדיקה חדשה",
  inspection_update: "עדכון בדיקה",
  inspection_delete: "מחיקת בדיקה",
  vehicle_insert: "רכב נוסף",
  vehicle_update: "עדכון פרטי רכב",
  vehicle_delete: "מחיקת רכב",
};
function display(value: Json | undefined, field: string): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean")
    return field === "fit_ok"
      ? value
        ? "כשיר ✅"
        : "לא כשיר ❌"
      : value
        ? "תקין ✅"
        : "לא תקין ❌";
  if (field === "status")
    return (
      (
        { ok: "תקין", not_ok: "לא תקין", unfit: "לא כשיר", not_checked: "לא נבדק" } as Record<
          string,
          string
        >
      )[String(value)] ?? String(value)
    );
  if (field === "inspection_date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value.split("-").reverse().join("/");
  return typeof value === "string" ? value : JSON.stringify(value);
}
// The caller must pass only events already filtered by event-time and current ownership.
export function detailedReportMessage(
  summary: string,
  events: MessageEvent[],
  vehicles: Record<string, { number: string; name: string }>,
  appUrl: string,
): string {
  if (!events.length) return summary;
  const groups = new Map<string, MessageEvent[]>();
  for (const event of events)
    groups.set(event.vehicle_id, [...(groups.get(event.vehicle_id) ?? []), event]);
  const blocks = [...groups].map(([id, list]) => {
    const identity = vehicles[id];
    const title = identity?.number
      ? `🚙 ${identity.number} — ${identity.name || "רכב"}`
      : "🚙 פרטי רכב אינם זמינים";
    return [
      title,
      ...list.map((event) => {
        const lines = [
          `🕒 ${formatIsrael(event.occurred_at)} · ${kinds[event.event_type] ?? "עדכון"}`,
        ];
        if (event.event_type === "inspection_insert" && !event.before_values)
          lines.push("אין בדיקה קודמת זמינה להשוואה.");
        for (const field of event.changed_fields.filter((f) => Object.hasOwn(fields, f))) {
          lines.push(
            `${fields[field]}:\nלפני: ${display(valueForField(event.before_values, field), field)}\nאחרי: ${display(valueForField(event.after_values, field), field)}`,
          );
        }
        return lines.join("\n\n");
      }),
    ].join("\n\n");
  });
  const header = summary.replace(/\n\n🔗[\s\S]*$/, "");
  return `${header}\n\nפירוט שינויים\n\n${blocks.join("\n\n──────────\n\n")}\n\n🔗 ${appUrl}`;
}
export function splitTelegramReport(text: string): string[] {
  const limit = 3800,
    parts: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut < limit / 3) cut = limit;
    const last = remaining.charCodeAt(cut - 1);
    if (last >= 0xd800 && last <= 0xdbff) cut--;
    parts.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n/, "");
  }
  if (remaining) parts.push(remaining);
  return parts.length > 1
    ? parts.map((part, i) => `📄 חלק ${i + 1} מתוך ${parts.length}\n\n${part}`)
    : parts;
}
