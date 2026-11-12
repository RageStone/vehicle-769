import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, RefreshCw, Unplug, Eye, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  getTelegramSettings,
  verifyUserTelegramBot,
  saveUserTelegramSettings,
  testUserTelegramMessage,
  toggleTelegramReporting,
  disconnectUserTelegramBot,
  previewUserDailyReport,
  sendUserDailyReport,
  saveUserReportHour,
} from "@/lib/telegram.functions";
import { valueForField } from "@/lib/telegram/report-details";
import { formatDate } from "@/lib/format";
import { formatIsrael, TEST_MESSAGE } from "@/lib/telegram/domain";
const T = {
  manual: "שלח דוח יומי עכשיו",
  confirmManual: "לשלוח עכשיו את הדוח היומי?",
  manualHint:
    "דוח מפורט לתקופה הנוכחית, עם מספרי ושמות הרכבים ושינויים לפני ואחרי, יישלח ליעד השמור. הדיווח האוטומטי ימשיך כרגיל.",
  manualSent: "הדוח היומי נשלח",
  hour: "שעת הדיווח שלי (שעון ישראל)",
  saveHour: "שמור שעה",
  hourSaved: "שעת הדיווח נשמרה",
  title: "הגדרות טלגרם",
  description: "חבר בוט טלגרם אישי לקבלת דוחות יומיים על הרכבים שלך.",
  token: "טוקן הבוט",
  chat: "מזהה צ׳אט / ערוץ",
  instructions:
    "צור בוט דרך BotFather והעתק לכאן את הטוקן. בצ׳אט פרטי יש ללחוץ Start אצל הבוט. בערוץ או בקבוצה יש להוסיף אותו עם הרשאת פרסום.",
  sensitive: "לטלגרם יישלחו מספרי ושמות הרכבים ופרטי השינויים לפני ואחרי, ליעד שבחרת.",
  verify: "בדיקת חיבור",
  save: "שמור הגדרות",
  test: "שלח הודעת ניסיון",
  replace: "החלף טוקן",
  disconnect: "נתק בוט",
  automatic: "דוח יומי אוטומטי",
  time: "שעת שליחה: 20:00 (שעון ישראל)",
  connected: "חיבור מאומת",
  disconnected: "לא מחובר",
  paused: "דיווח מושהה",
  active: "דיווח פעיל",
  lastSuccess: "מסירה מוצלחת אחרונה",
  next: "הדוח הבא",
  history: "היסטוריית דוחות",
  empty: "אין עדיין דוחות",
  error: "שגיאה אחרונה",
  preview: "תצוגה מקדימה של הדוח הבא",
  details: "פירוט שינויים באתר",
  noChanges: "אין שינויים בתקופה הנוכחית",
  before: "לפני",
  after: "אחרי",
  privateHint: "בצ׳אט פרטי ודא שהתחלת שיחה עם הבוט לפני הודעת הניסיון.",
  confirmTest: "לשלוח הודעת ניסיון ליעד המאומת?",
  confirmDisconnect: "לנתק את הבוט האישי?",
  disconnectHint: "הטוקן השמור יימחק והדיווח האוטומטי ייפסק. היסטוריית הדוחות תישמר.",
  cancel: "ביטול",
  confirm: "אישור",
  saved: "ההגדרות נשמרו; הפעל דיווח אוטומטי כשתהיה מוכן.",
  tested: "הודעת הניסיון נשלחה",
  loading: "טוען הגדרות",
  updates: "שינויים",
  vehicles: "רכבים",
  tests: "בדיקות",
  statuses: {
    claimed: "ממתין",
    sending: "שליחה החלה — ללא ניסיון חוזר",
    sent: "נשלח",
    failed: "נכשל",
    ambiguous: "תוצאת שליחה לא ידועה",
    cancelled: "בוטל",
  },
  kinds: {
    vehicle_insert: "רכב נוסף",
    vehicle_update: "פרטי רכב עודכנו",
    vehicle_delete: "רכב נמחק",
    inspection_insert: "בדיקה חדשה",
    inspection_update: "בדיקה עודכנה",
    inspection_delete: "בדיקה נמחקה",
  },
  fields: {
    notes: "הערות",
    category: "קטגוריה",
    vehicle_number: "מספר רכב",
    status: "סטטוס",
    radio_ok: "רדיו",
    shov_ok: "שוב",
    winter_ok: "טיפול חורף",
    fit_ok: "כשירות",
    inspection_date: "תאריך בדיקה",
    user_id: "שיוך חשבון",
    id: "מזהה רשומה",
    vehicle_id: "שיוך רכב",
  },
};
type Preview = Awaited<ReturnType<typeof previewUserDailyReport>>;
function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value === true) return "✅";
  if (value === false) return "❌";
  if (value === "ok") return "תקין";
  if (value === "not_ok") return "לא תקין";
  if (value === "unfit") return "לא כשיר";
  if (value === "not_checked") return "לא נבדק";
  return typeof value === "string" ? value : JSON.stringify(value);
}
export function TelegramSettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="size-9 shrink-0"
        aria-label={T.title}
        title={T.title}
        onClick={() => setOpen(true)}
      >
        <Send className="size-4" />
      </Button>
      <TelegramSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
function TelegramSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const read = useServerFn(getTelegramSettings),
    verify = useServerFn(verifyUserTelegramBot),
    save = useServerFn(saveUserTelegramSettings),
    test = useServerFn(testUserTelegramMessage),
    toggle = useServerFn(toggleTelegramReporting),
    disconnect = useServerFn(disconnectUserTelegramBot),
    previewFn = useServerFn(previewUserDailyReport),
    manual = useServerFn(sendUserDailyReport),
    saveHour = useServerFn(saveUserReportHour);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["telegram-settings"],
    queryFn: () => read(),
    enabled: open,
    staleTime: 0,
  });
  const settings = query.data?.settings;
  const [token, setToken] = useState(""),
    [chatId, setChatId] = useState(""),
    [replace, setReplace] = useState(false),
    [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState<Awaited<
    ReturnType<typeof verifyUserTelegramBot>
  > | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null),
    [confirmation, setConfirmation] = useState<"test" | "disconnect" | "manual" | null>(null);
  const [hour, setHour] = useState(20),
    [manualKey, setManualKey] = useState(() => crypto.randomUUID()),
    [manualUncertain, setManualUncertain] = useState(false);
  useEffect(() => {
    setHour(settings?.report_hour ?? 20);
  }, [settings?.report_hour]);
  useEffect(() => {
    if (open) {
      setChatId(settings?.telegram_chat_id ?? "");
      setToken("");
      setVerified(null);
      setReplace(false);
      setPreview(null);
    }
  }, [open, settings?.telegram_chat_id]);
  useEffect(() => {
    if (!open) {
      setToken("");
      setVerified(null);
    }
  }, [open]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "פעולת טלגרם נכשלה");
    } finally {
      setBusy(false);
    }
  };
  const refresh = () => qc.invalidateQueries({ queryKey: ["telegram-settings"] });
  const changed = (settings?.telegram_chat_id ?? "") !== chatId || token.length > 0;
  const canSubmit =
    /^-?[0-9]{1,20}$/.test(chatId) && (!!settings || !!token) && (!replace || !!token);
  const grouped = new Map<string, Preview["events"]>();
  for (const event of preview?.events ?? [])
    grouped.set(event.vehicle_id, [...(grouped.get(event.vehicle_id) ?? []), event]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle className="text-right">{T.title}</DialogTitle>
          <DialogDescription className="text-right">{T.description}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <p className="text-muted-foreground">{T.loading}</p>
        ) : query.isError ? (
          <div role="alert">
            <p>{query.error.message}</p>
            <Button variant="outline" onClick={() => query.refetch()}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="min-w-0 space-y-5">
            <section className="space-y-2 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="size-4" />
                {settings?.connection_verified ? T.connected : T.disconnected}
                {settings && (
                  <span className="text-muted-foreground">
                    {settings.enabled ? T.active : T.paused}
                  </span>
                )}
              </p>
              {settings && (
                <>
                  <p className="break-words">
                    <b dir="ltr">@{settings.telegram_bot_username}</b> ·{" "}
                    {settings.telegram_chat_title}
                  </p>
                  <p className="text-muted-foreground" dir="ltr">
                    {settings.telegram_chat_id}
                  </p>
                  <p>
                    {T.lastSuccess}:{" "}
                    {settings.last_success_at ? formatIsrael(settings.last_success_at) : "—"}
                  </p>
                  {settings.last_error && (
                    <p role="alert" className="text-destructive">
                      {T.error}: {settings.last_error}
                    </p>
                  )}
                </>
              )}
            </section>
            <section className="space-y-3 border-t pt-4">
              {!settings || replace ? (
                <div className="space-y-1">
                  <Label htmlFor="telegram-token">{T.token}</Label>
                  <Input
                    id="telegram-token"
                    type="password"
                    autoComplete="off"
                    dir="ltr"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      setVerified(null);
                    }}
                  />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReplace(true);
                    setVerified(null);
                  }}
                >
                  {T.replace}
                </Button>
              )}
              <p className="text-sm text-muted-foreground">
                <a
                  className="text-primary underline"
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  BotFather
                </a>{" "}
                — {T.instructions}
              </p>
              <div className="space-y-1">
                <Label htmlFor="telegram-chat">{T.chat}</Label>
                <Input
                  id="telegram-chat"
                  dir="ltr"
                  inputMode="text"
                  value={chatId}
                  onChange={(e) => {
                    setChatId(e.target.value.trim());
                    setVerified(null);
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={busy || !canSubmit}
                  onClick={() =>
                    run(async () =>
                      setVerified(await verify({ data: { token: token || undefined, chatId } })),
                    )
                  }
                >
                  {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
                  {T.verify}
                </Button>
                <Button
                  disabled={busy || !verified || !canSubmit}
                  onClick={() =>
                    run(async () => {
                      await save({ data: { token: token || undefined, chatId } });
                      setToken("");
                      setReplace(false);
                      setVerified(null);
                      await refresh();
                      toast.success(T.saved);
                    })
                  }
                >
                  {T.save}
                </Button>
              </div>
              {verified && (
                <p role="status" className="break-words text-sm">
                  ✅ <span dir="ltr">@{verified.username}</span> · {verified.title}
                  {verified.privateChat && (
                    <span className="mt-1 block text-muted-foreground">{T.privateHint}</span>
                  )}
                </p>
              )}
            </section>
            <section className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="telegram-auto">{T.automatic}</Label>
                <Switch
                  id="telegram-auto"
                  checked={settings?.enabled ?? false}
                  disabled={busy || !settings?.connection_verified || changed || replace}
                  onCheckedChange={(enabled) =>
                    run(async () => {
                      await toggle({ data: { enabled } });
                      await refresh();
                    })
                  }
                />
              </div>
              <p className="text-sm">
                שעת שליחה: {String(settings?.report_hour ?? 20).padStart(2, "0")}:00 (שעון ישראל)
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="telegram-hour">{T.hour}</Label>
                  <select
                    id="telegram-hour"
                    className="h-11 w-full rounded-md border bg-background px-3"
                    value={hour}
                    disabled={busy || !settings}
                    onChange={(e) => setHour(Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  disabled={busy || !settings || hour === settings.report_hour}
                  onClick={() =>
                    run(async () => {
                      await saveHour({ data: { hour } });
                      await refresh();
                      toast.success(T.hourSaved);
                    })
                  }
                >
                  {T.saveHour}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {T.next}: {query.data?.next ? formatIsrael(query.data.next) : "—"}
              </p>
              <p className="text-sm text-muted-foreground">{T.sensitive}</p>
            </section>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={
                  busy ||
                  !settings?.connection_verified ||
                  changed ||
                  replace ||
                  manualUncertain ||
                  hour !== settings.report_hour
                }
                onClick={() => setConfirmation("manual")}
              >
                <Send className="size-4" />
                {T.manual}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => run(async () => setPreview(await previewFn()))}
              >
                <Eye className="size-4" />
                {T.preview}
              </Button>
              <Button
                variant="outline"
                disabled={busy || !settings?.connection_verified || changed || replace}
                onClick={() => setConfirmation("test")}
              >
                <Send className="size-4" />
                {T.test}
              </Button>
              {settings && (
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setConfirmation("disconnect")}
                >
                  <Unplug className="size-4" />
                  {T.disconnect}
                </Button>
              )}
            </div>
            {preview && (
              <section className="space-y-3 border-t pt-4">
                <h3 className="font-semibold">{T.preview}</h3>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm">
                  {preview.message}
                </pre>
                <h4 className="font-semibold">{T.details}</h4>
                {!preview.events.length && (
                  <p className="text-sm text-muted-foreground">{T.noChanges}</p>
                )}
                {[...grouped].map(([vehicleId, events], index) => (
                  <div key={vehicleId} className="space-y-2 border-s-2 ps-3">
                    <h5 className="font-medium">
                      {preview.vehicles[vehicleId]?.number ? (
                        <>
                          <span dir="ltr">{preview.vehicles[vehicleId].number}</span> —{" "}
                          {preview.vehicles[vehicleId].name || "רכב"}
                        </>
                      ) : (
                        "פרטי הרכב אינם זמינים"
                      )}
                    </h5>
                    {events.map((event) => (
                      <div key={event.id} className="space-y-1 text-sm">
                        <p className="font-medium">
                          {formatIsrael(event.occurred_at)} ·{" "}
                          {T.kinds[event.event_type as keyof typeof T.kinds] ?? event.event_type}
                        </p>
                        {event.event_type === "inspection_insert" && !event.before_values && (
                          <p className="text-muted-foreground">אין בדיקה קודמת מתועדת</p>
                        )}
                        {event.changed_fields
                          .filter((field) => !["id", "vehicle_id", "user_id"].includes(field))
                          .map((field) => {
                            const before = valueForField(event.before_values, field),
                              after = valueForField(event.after_values, field);
                            const show = (value: typeof before) =>
                              field === "inspection_date" && typeof value === "string"
                                ? formatDate(value)
                                : displayValue(value);
                            return (
                              <div className="rounded-md bg-muted/30 p-2" key={field}>
                                <p className="font-medium">
                                  {T.fields[field as keyof typeof T.fields] ?? field}
                                </p>
                                <dl className="mt-1 grid grid-cols-2 gap-3">
                                  <div>
                                    <dt className="text-xs text-muted-foreground">{T.before}</dt>
                                    <dd className="break-words">{show(before)}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs text-muted-foreground">{T.after}</dt>
                                    <dd className="break-words">{show(after)}</dd>
                                  </div>
                                </dl>
                              </div>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            )}
            <section className="space-y-3 border-t pt-4">
              <h3 className="font-semibold">{T.history}</h3>
              {!query.data?.history.length && (
                <p className="text-sm text-muted-foreground">{T.empty}</p>
              )}
              {query.data?.history.map((report) => (
                <div className="border-b pb-3 text-sm" key={report.id}>
                  <div className="flex flex-wrap justify-between gap-1">
                    <span>{formatIsrael(report.period_end)}</span>
                    <span>
                      {report.delivery_kind === "manual" ? "ידני · " : ""}
                      {T.statuses[report.delivery_status as keyof typeof T.statuses] ??
                        report.delivery_status}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {report.changes_count} {T.updates} · {report.vehicles_count} {T.vehicles} ·{" "}
                    {report.tests_count} {T.tests}
                  </p>
                  {report.message_parts > 1 && (
                    <p className="text-muted-foreground">
                      נשלחו {report.sent_parts} מתוך {report.message_parts} חלקים
                    </p>
                  )}
                  {report.last_error && (
                    <p className="break-words text-destructive">{report.last_error}</p>
                  )}
                </div>
              ))}
            </section>
          </div>
        )}
        <AlertDialog open={!!confirmation} onOpenChange={(o) => !o && setConfirmation(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmation === "manual"
                  ? T.confirmManual
                  : confirmation === "test"
                    ? T.confirmTest
                    : T.confirmDisconnect}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmation === "manual"
                  ? `${settings?.telegram_chat_title ?? ""}: ${T.manualHint}`
                  : confirmation === "test"
                    ? `${settings?.telegram_chat_title ?? ""}: ${TEST_MESSAGE}`
                    : T.disconnectHint}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{T.cancel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const action = confirmation;
                  setConfirmation(null);
                  run(async () => {
                    if (action === "manual") {
                      const result = await manual({
                        data: { confirmed: true, requestKey: manualKey },
                      });
                      await refresh();
                      if (result.delivery_status === "sent") {
                        setManualKey(crypto.randomUUID());
                        toast.success(T.manualSent);
                      } else if (
                        ["claimed", "sending", "ambiguous"].includes(result.delivery_status)
                      ) {
                        setManualUncertain(true);
                        toast.error(
                          result.last_error ||
                            "השליחה עדיין בעיבוד או שתוצאתה אינה ידועה; בדוק בהיסטוריה",
                        );
                      } else {
                        setManualKey(crypto.randomUUID());
                        toast.error(result.last_error || "הדוח לא נשלח");
                      }
                    } else if (action === "test") {
                      await test({ data: { confirmed: true } });
                      toast.success(T.tested);
                    } else {
                      await disconnect({ data: { confirmed: true } });
                      setToken("");
                      setChatId("");
                      setVerified(null);
                      await refresh();
                    }
                  });
                }}
              >
                {T.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
