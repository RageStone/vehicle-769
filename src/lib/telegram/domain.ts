export const ZONE = 'Asia/Jerusalem';
export const APP_URL = 'https://vehicle-769.lovable.app';
export const TEST_MESSAGE = '✅ הבוט של Vehicle 769 מחובר בהצלחה!';
export function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (key: string) => parts.find(p => p.type === key)?.value ?? '';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}
export function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10);
}
export function atIsrael20(day: string) {
  const target = Date.parse(`${day}T20:00:00Z`);
  let candidate = new Date(target);
  for (let i = 0; i < 3; i++) {
    const p = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(candidate);
    const localAsUTC = Date.parse(p.replace(' ', 'T') + 'Z');
    candidate = new Date(candidate.getTime() + target - localAsUTC);
  }
  return candidate.toISOString();
}
export function reportPeriod(now: Date, next = false) {
  const local = localParts(now);
  const day = shiftDay(local.day, next ? (local.hour >= 20 ? 1 : 0) : (local.hour < 20 ? -1 : 0));
  return { start: atIsrael20(shiftDay(day, -1)), end: atIsrael20(day) };
}
export interface AuditEvent { id: string; vehicle_id: string; owner_at_event: string | null; event_type: string; occurred_at: string; }
export function eligibleEvents<T extends AuditEvent>(events: T[], userId: string, owners: Map<string, string | null>, start: string, end: string) {
  return events.filter(e => e.owner_at_event === userId && (!owners.has(e.vehicle_id) || owners.get(e.vehicle_id) === userId) && e.occurred_at >= start && e.occurred_at < end);
}
export function summarize(events: AuditEvent[]) {
  return { changes_count: events.length, vehicles_count: new Set(events.map(e => e.vehicle_id)).size, tests_count: events.filter(e => e.event_type === 'inspection_insert').length };
}
export const formatIsrael = (iso: string) => new Intl.DateTimeFormat('he-IL', { timeZone: ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export function reportMessage(period: { start: string; end: string }, counts: ReturnType<typeof summarize>) {
  const date = formatIsrael(period.end).split(',')[0];
  if (!counts.changes_count) return `🚗 דוח עדכוני רכבים יומי\n📅 ${date}\n\n✅ לא בוצעו עדכונים במערכת בתקופת הדיווח.\n\n🔗 ${APP_URL}`;
  return `🚗 דוח עדכוני רכבים יומי\n📅 ${date}\n\n🕒 תקופת דיווח:\n${formatIsrael(period.start)} – ${formatIsrael(period.end)}\n\n📊 סיכום פעילות\n\n📝 סה״כ שינויים: ${counts.changes_count}\n🚙 רכבים שעודכנו: ${counts.vehicles_count}\n🔧 בדיקות שבוצעו: ${counts.tests_count}\n\n🔗 לצפייה בדוח:\n${APP_URL}`;
}
