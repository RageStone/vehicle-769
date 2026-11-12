export const ZONE = "Asia/Jerusalem";
export const APP_URL = "https://vehicle-769.lovable.app";
export const TEST_MESSAGE = "✅ הבוט של Vehicle 769 מחובר בהצלחה!";
export function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}
export function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
export function atIsraelHour(day: string, hour = 20) {
  const target = Date.parse(day + "T" + String(hour).padStart(2, "0") + ":00:00Z");
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const wall = (utc: number) => Date.parse(formatter.format(new Date(utc)).replace(" ", "T") + "Z");
  const offsets = new Set(
    [-36, -12, 0, 12, 36].map((h) => {
      const t = target + h * 3600000;
      return wall(t) - t;
    }),
  );
  const candidates = [...offsets].map((offset) => target - offset).sort((a, b) => a - b);
  // Choose the first occurrence of a repeated hour. A skipped spring hour runs
  // at the first corresponding later wall time, once for that local day.
  const exact = candidates.find((t) => wall(t) === target);
  const chosen =
    exact ??
    candidates.filter((t) => wall(t) > target).sort((a, b) => wall(a) - wall(b) || a - b)[0];
  if (chosen === undefined) throw new Error("Unable to resolve Israel report time");
  return new Date(chosen).toISOString();
}
export const atIsrael20 = (day: string) => atIsraelHour(day, 20);
export function reportPeriod(now: Date, next = false, hour = 20) {
  const local = localParts(now),
    boundary = atIsraelHour(local.day, hour);
  const after = now.getTime() >= Date.parse(boundary);
  const day = shiftDay(local.day, next ? (after ? 1 : 0) : after ? 0 : -1);
  return { start: atIsraelHour(shiftDay(day, -1), hour), end: atIsraelHour(day, hour) };
}
export function manualPeriod(now: Date, hour = 20) {
  const current = reportPeriod(now, true, hour);
  return {
    start:
      current.start === now.toISOString() ? reportPeriod(now, false, hour).start : current.start,
    end: now.toISOString(),
  };
}
export interface AuditEvent {
  id: string;
  vehicle_id: string;
  owner_at_event: string | null;
  event_type: string;
  occurred_at: string;
}
export function eligibleEvents<T extends AuditEvent>(
  events: T[],
  userId: string,
  owners: Map<string, string | null>,
  start: string,
  end: string,
) {
  return events.filter(
    (e) =>
      e.owner_at_event === userId &&
      (!owners.has(e.vehicle_id) || owners.get(e.vehicle_id) === userId) &&
      e.occurred_at >= start &&
      e.occurred_at < end,
  );
}
export function summarize(events: AuditEvent[]) {
  return {
    changes_count: events.length,
    vehicles_count: new Set(events.map((e) => e.vehicle_id)).size,
    tests_count: events.filter((e) => e.event_type === "inspection_insert").length,
  };
}
export const formatIsrael = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", {
    timeZone: ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
export function reportDate(iso: string) {
  const { day } = localParts(new Date(iso));
  return day.split("-").reverse().join("/");
}
export function nextDuePeriod(
  enabledAt: string,
  previousEnd: string | undefined,
  now: Date,
  hour = 20,
  scheduleChangedAt?: string | null,
) {
  const cursor = [enabledAt, previousEnd, scheduleChangedAt]
    .filter((x): x is string => !!x)
    .sort()
    .at(-1)!;
  const period = reportPeriod(new Date(cursor), true, hour);
  return period.end <= reportPeriod(now, false, hour).end
    ? { ...period, start: previousEnd && previousEnd > enabledAt ? previousEnd : period.start }
    : null;
}
export function reportMessage(
  period: { start: string; end: string },
  counts: ReturnType<typeof summarize>,
  appUrl = APP_URL,
) {
  const date = reportDate(period.end);
  if (!counts.changes_count)
    return `🚗 דוח עדכוני רכבים יומי\n📅 ${date}\n\n✅ לא בוצעו עדכונים במערכת בתקופת הדיווח.\n\n🔗 ${appUrl}`;
  return `🚗 דוח עדכוני רכבים יומי\n📅 ${date}\n\n🕒 תקופת דיווח:\n${formatIsrael(period.start)} – ${formatIsrael(period.end)}\n\n📊 סיכום פעילות\n\n📝 סה״כ שינויים: ${counts.changes_count}\n🚙 רכבים שעודכנו: ${counts.vehicles_count}\n🔧 בדיקות שבוצעו: ${counts.tests_count}\n\n🔗 לצפייה בדוח:\n${appUrl}`;
}
