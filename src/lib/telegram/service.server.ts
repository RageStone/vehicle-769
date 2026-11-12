import { supabaseAdmin } from "../../integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../integrations/supabase/types";
import { decryptToken, encryptToken } from "./crypto.server";
import { sendMessage, TelegramFailure, verifyDestination } from "./api.server";
import {
  eligibleEvents,
  nextDuePeriod,
  reportMessage,
  reportPeriod,
  summarize,
  TEST_MESSAGE,
  APP_URL,
  manualPeriod,
} from "./domain";
import { previousInspection, reportVehicle, snapshot } from "./report-details";
import { detailedReportMessage, splitTelegramReport } from "./message";
export async function storedToken(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("telegram_credentials")
    .select("ciphertext")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("חבר קודם בוט אישי");
  return decryptToken(data.ciphertext, userId);
}
export async function saveSettings(userId: string, token: string | undefined, chatId: string) {
  const actual = token || (await storedToken(userId));
  const verified = await verifyDestination(actual, chatId);
  const ciphertext = await encryptToken(actual, userId);
  const { error } = await supabaseAdmin.rpc("save_verified_telegram_config", {
    p_user_id: userId,
    p_bot_id: verified.botId,
    p_username: verified.username,
    p_chat_id: chatId,
    p_title: verified.title,
    p_ciphertext: ciphertext,
  });
  if (error)
    throw new Error(error.code === "23505" ? "הבוט כבר מחובר לחשבון אחר" : "שמירת החיבור נכשלה");
  return verified;
}
export async function generateReport(
  client: SupabaseClient<Database>,
  userId: string,
  period: { start: string; end: string },
  details = false,
) {
  // SQL owner predicate, plus current vehicle access. Actor identity is never the filter.
  const events: Database["public"]["Tables"]["vehicle_audit_events"]["Row"][] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("vehicle_audit_events")
      .select("*")
      .eq("owner_at_event", userId)
      .gte("occurred_at", period.start)
      .lt("occurred_at", period.end)
      .order("occurred_at")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("קריאת השינויים נכשלה");
    events.push(...data);
    if (data.length < 500) break;
  }
  const owners = new Map<string, string | null>();
  const vehicleLabels: Record<string, { number: string; name: string }> = {};
  const ids = [...new Set(events.map((e) => e.vehicle_id))];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .select("id,user_id,vehicle_number,category,notes")
      .in("id", ids.slice(i, i + 100));
    if (error) throw new Error("בדיקת בעלות נכשלה");
    for (const v of data) {
      owners.set(v.id, v.user_id);
      if (v.user_id === userId) vehicleLabels[v.id] = reportVehicle(v);
    }
  }
  const allowed = eligibleEvents(events, userId, owners, period.start, period.end);
  const counts = summarize(allowed);
  const inspectionHistory: Database["public"]["Tables"]["inspections"]["Row"][] = [];
  {
    const legacyIds = [
      ...new Set(
        allowed
          .filter((e) => e.event_type === "inspection_insert" && !e.before_values)
          .map((e) => e.vehicle_id),
      ),
    ];
    for (let i = 0; i < legacyIds.length; i += 100)
      for (let offset = 0; ; offset += 500) {
        const result = await client
          .from("inspections")
          .select("*")
          .eq("user_id", userId)
          .in("vehicle_id", legacyIds.slice(i, i + 100))
          .order("created_at")
          .order("id")
          .range(offset, offset + 499);
        if (result.error) throw new Error("קריאת הבדיקה הקודמת נכשלה");
        inspectionHistory.push(...result.data);
        if (result.data.length < 500) break;
      }
  }
  const detailedEvents = allowed.map((event) => {
    if (!vehicleLabels[event.vehicle_id]) {
      const identity =
        event.vehicle_snapshot ??
        (event.event_type.startsWith("vehicle_")
          ? (event.after_values ?? event.before_values)
          : null);
      const label = reportVehicle(identity);
      if (label.number) vehicleLabels[event.vehicle_id] = label;
    }
    const before =
      event.event_type === "inspection_insert" && !event.before_values
        ? previousInspection(
            inspectionHistory,
            event.vehicle_id,
            userId,
            event.occurred_at,
            snapshot(event.after_values)?.id,
          )
        : event.before_values;
    return {
      ...event,
      before_values: before,
      changed_fields:
        event.event_type === "inspection_insert"
          ? ["status", "fit_ok", "radio_ok", "shov_ok", "winter_ok", "inspection_date", "notes"]
          : event.changed_fields,
    };
  });
  const appUrl = process.env.APP_URL || APP_URL;
  const message = detailedReportMessage(
    reportMessage(period, counts, appUrl),
    detailedEvents,
    vehicleLabels,
    appUrl,
  );
  return {
    period,
    counts,
    message,
    messages: splitTelegramReport(message),
    events: details ? detailedEvents : [],
    vehicles: details ? vehicleLabels : {},
  };
}
export async function safeTest(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("telegram_settings")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !data?.connection_verified) throw new Error("נדרש חיבור מאומת");
  const token = await storedToken(userId);
  await verifyDestination(token, data.telegram_chat_id);
  await sendMessage(token, data.telegram_chat_id, TEST_MESSAGE);
}
export async function processDueReports(now = new Date()) {
  return processReports(
    supabaseAdmin,
    { generateReport, storedToken, verifyDestination, sendMessage },
    now,
  );
}

// Dependency injection keeps delivery failure and concurrency tests off the live backend.
export async function processReports(
  admin: SupabaseClient<Database>,
  actions: {
    generateReport: typeof generateReport;
    storedToken: typeof storedToken;
    verifyDestination: typeof verifyDestination;
    sendMessage: typeof sendMessage;
  },
  now = new Date(),
) {
  const { data: configs, error } = await admin
    .from("telegram_settings")
    .select("*")
    .eq("enabled", true)
    .eq("connection_verified", true);
  if (error) throw new Error("קריאת החיבורים נכשלה");
  let processed = 0;
  const failures: string[] = [];
  for (const config of configs ?? []) {
    if (processed >= 25) break;
    // Only periods completed since the user explicitly enabled delivery are eligible.
    if (
      !config.enabled_at ||
      reportPeriod(now, false, config.report_hour ?? 20).end <= config.enabled_at
    )
      continue;
    try {
      const { data: previous, error: historyError } = await admin
        .from("telegram_reports")
        .select("period_end")
        .eq("delivery_kind", "scheduled")
        .eq("user_id", config.user_id)
        .order("period_end", { ascending: false })
        .limit(1);
      if (historyError) throw new Error("Report history unavailable");
      const period = nextDuePeriod(
        config.enabled_at,
        previous?.[0]?.period_end,
        now,
        config.report_hour ?? 20,
        config.schedule_changed_at,
      );
      if (!period) continue;
      const { data: id, error: claimError } = await admin.rpc("claim_telegram_report", {
        p_user_id: config.user_id,
        p_start: period.start,
        p_end: period.end,
      });
      if (claimError) throw new Error("Report claim failed");
      if (!id) continue;
      processed++;
      await deliverClaimedReport(admin, actions, config, id, period);
    } catch {
      failures.push(config.user_id);
    }
  }
  if (failures.length)
    throw new Error(`Telegram processing failed for ${failures.length} account(s)`);
  return { processed };
}

export type DeliveryActions = Parameters<typeof processReports>[1];
type DeliveryConfig = Pick<
  Database["public"]["Tables"]["telegram_settings"]["Row"],
  "user_id" | "updated_at" | "telegram_chat_id"
>;
export async function deliverClaimedReport(
  admin: SupabaseClient<Database>,
  actions: DeliveryActions,
  config: DeliveryConfig,
  id: string,
  period: { start: string; end: string },
  requireEnabled = true,
) {
  let sending = false;
  const deliveredIds: number[] = [];
  let totalParts = 1;
  try {
    const report = await actions.generateReport(admin, config.user_id, period);
    const messages = report.messages;
    totalParts = messages.length;
    const token = await actions.storedToken(config.user_id);
    await actions.verifyDestination(token, config.telegram_chat_id);
    // Re-read configuration immediately before sending: pause, disconnect and rotation cancel stale work.
    const { data: current, error: currentError } = await admin
      .from("telegram_settings")
      .select("enabled,updated_at,connection_verified")
      .eq("user_id", config.user_id)
      .single();
    if (currentError) throw new Error("Settings unavailable");
    if (
      !current ||
      (requireEnabled && !current.enabled) ||
      current.connection_verified === false ||
      current.updated_at !== config.updated_at
    ) {
      await admin.from("telegram_reports").update({ delivery_status: "cancelled" }).eq("id", id);
      return;
    }
    const { data: started, error: writeError } = await admin
      .from("telegram_reports")
      .update({
        ...report.counts,
        delivery_status: "sending",
        send_attempts: 1,
        message_parts: totalParts,
        sent_parts: 0,
      })
      .eq("id", id)
      .eq("delivery_status", "claimed")
      .select("id")
      .maybeSingle();
    if (writeError) throw new Error("שמירת ניסיון השליחה נכשלה");
    if (!started) return;
    sending = true;
    for (const text of messages) {
      if (deliveredIds.length) {
        const latest = await admin
          .from("telegram_settings")
          .select("enabled,updated_at,connection_verified")
          .eq("user_id", config.user_id)
          .single();
        if (
          latest.error ||
          !latest.data ||
          (requireEnabled && !latest.data.enabled) ||
          latest.data.connection_verified === false ||
          latest.data.updated_at !== config.updated_at
        )
          throw new Error("Report configuration changed during delivery");
      }
      const result = await actions.sendMessage(token, config.telegram_chat_id, text);
      deliveredIds.push(result.message_id);
      const progress = await admin
        .from("telegram_reports")
        .update({
          telegram_message_id: deliveredIds[0],
          telegram_message_ids: [...deliveredIds],
          sent_parts: deliveredIds.length,
        })
        .eq("id", id);
      if (progress.error) throw new Error("Delivery progress could not be saved");
    }
    const sentAt = new Date().toISOString();
    const { error: resultError } = await admin
      .from("telegram_reports")
      .update({
        delivery_status: "sent",
        telegram_message_id: deliveredIds[0],
        sent_at: sentAt,
      })
      .eq("id", id);
    if (resultError) throw new Error("תוצאת השליחה לא נשמרה");
    await admin
      .from("telegram_settings")
      .update({ last_success_at: sentAt, last_error: null })
      .eq("user_id", config.user_id);
  } catch (error) {
    const ambiguous =
      deliveredIds.length > 0 || (error instanceof TelegramFailure ? error.ambiguous : sending);
    const failureMessage =
      error instanceof TelegramFailure
        ? error.message
        : ambiguous
          ? "תוצאת השליחה אינה ידועה; לא תבוצע שליחה חוזרת"
          : "יצירת הדוח נכשלה";
    const message =
      deliveredIds.length > 0
        ? `נשלחו ${deliveredIds.length} מתוך ${totalParts} חלקים; אין שליחה חוזרת אוטומטית. ${failureMessage}`
        : failureMessage;
    const { error: failureError } = await admin
      .from("telegram_reports")
      .update({ delivery_status: ambiguous ? "ambiguous" : "failed", last_error: message })
      .eq("id", id);
    if (failureError) throw new Error("Report failure state could not be saved");
    await admin
      .from("telegram_settings")
      .update({
        last_error: message,
        ...(error instanceof TelegramFailure && [401, 403].includes(error.code)
          ? { enabled: false, connection_verified: false }
          : {}),
      })
      .eq("user_id", config.user_id);
  }
}
export async function sendManualReport(
  admin: SupabaseClient<Database>,
  actions: DeliveryActions,
  userId: string,
  requestKey: string,
  now = new Date(),
) {
  const { data: config, error } = await admin
    .from("telegram_settings")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !config?.connection_verified) throw new Error("נדרש חיבור טלגרם מאומת");
  const period = manualPeriod(now, config.report_hour);
  const claim = await admin.rpc("claim_manual_telegram_report", {
    p_user_id: userId,
    p_request_key: requestKey,
    p_start: period.start,
    p_end: period.end,
  });
  if (claim.error) throw new Error("יצירת הדוח הידני נכשלה");
  if (claim.data) await deliverClaimedReport(admin, actions, config, claim.data, period, false);
  const result = await admin
    .from("telegram_reports")
    .select("id,delivery_status,last_error")
    .eq("user_id", userId)
    .eq("request_key", requestKey)
    .single();
  if (result.error) throw new Error("תוצאת השליחה אינה זמינה; בדוק בהיסטוריה לפני ניסיון נוסף");
  return result.data;
}
export async function manualDailyReport(userId: string, requestKey: string) {
  return sendManualReport(
    supabaseAdmin,
    { generateReport, storedToken, verifyDestination, sendMessage },
    userId,
    requestKey,
  );
}
