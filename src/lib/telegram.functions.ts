import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reportPeriod } from "./telegram/domain";
const input = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{5,20}:[A-Za-z0-9_-]{20,100}$/)
    .optional(),
  chatId: z.string().regex(/^-?[0-9]{1,20}$/),
});
export const getTelegramSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [settings, history] = await Promise.all([
      context.supabase
        .from("telegram_settings")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("telegram_reports")
        .select("*")
        .eq("user_id", context.userId)
        .order("period_end", { ascending: false })
        .limit(20),
    ]);
    if (settings.error || history.error) throw new Error("קריאת הגדרות טלגרם נכשלה");
    return {
      settings: settings.data,
      history: history.data ?? [],
      next: settings.data?.enabled
        ? reportPeriod(new Date(), true, settings.data.report_hour).end
        : null,
    };
  });
export const verifyUserTelegramBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }) => {
    const { verifyDestination } = await import("./telegram/api.server");
    const { storedToken } = await import("./telegram/service.server");
    return verifyDestination(data.token || (await storedToken(context.userId)), data.chatId);
  });
export const saveUserTelegramSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }) => {
    const { saveSettings } = await import("./telegram/service.server");
    return saveSettings(context.userId, data.token, data.chatId);
  });
export const toggleTelegramReporting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ enabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { data: settings } = await context.supabase
        .from("telegram_settings")
        .select("*")
        .eq("user_id", context.userId)
        .single();
      if (!settings?.connection_verified) throw new Error("נדרש חיבור מאומת");
      const { storedToken } = await import("./telegram/service.server");
      const { verifyDestination } = await import("./telegram/api.server");
      await verifyDestination(await storedToken(context.userId), settings.telegram_chat_id);
    }
    const { error } = await supabaseAdmin
      .from("telegram_settings")
      .update({
        enabled: data.enabled,
        enabled_at: data.enabled ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId);
    if (error) throw new Error("עדכון מצב הדיווח נכשל");
    return { ok: true };
  });
export const testUserTelegramMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ confirmed: z.literal(true) }))
  .handler(async ({ context }) => {
    const { safeTest } = await import("./telegram/service.server");
    await safeTest(context.userId);
    return { ok: true };
  });
export const disconnectUserTelegramBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ confirmed: z.literal(true) }))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("telegram_settings")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error("ניתוק הבוט נכשל");
    return { ok: true };
  });
export const previewUserDailyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateReport } = await import("./telegram/service.server");
    const { data: settings, error } = await context.supabase
      .from("telegram_settings")
      .select("report_hour")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("טעינת שעת הדיווח נכשלה");
    return generateReport(
      context.supabase,
      context.userId,
      reportPeriod(new Date(), true, settings?.report_hour ?? 20),
      true,
    );
  });

export const sendUserDailyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ confirmed: z.literal(true), requestKey: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { manualDailyReport } = await import("./telegram/service.server");
    return manualDailyReport(context.userId, data.requestKey);
  });
export const saveUserReportHour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ hour: z.number().int().min(0).max(23) }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin
      .from("telegram_settings")
      .update({
        report_hour: data.hour,
        schedule_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId)
      .select("report_hour")
      .single();
    if (result.error) throw new Error("שמירת שעת הדיווח נכשלה");
    return result.data;
  });
