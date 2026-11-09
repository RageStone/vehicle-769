import { supabaseAdmin } from '@/integrations/supabase/client.server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { decryptToken, encryptToken } from './crypto.server';
import { sendMessage, TelegramFailure, verifyDestination } from './api.server';
import { eligibleEvents, reportMessage, reportPeriod, summarize, TEST_MESSAGE } from './domain';
export async function storedToken(userId: string) {
  const { data, error } = await supabaseAdmin.from('telegram_credentials').select('ciphertext').eq('user_id', userId).single();
  if (error || !data) throw new Error('חבר קודם בוט אישי');
  return decryptToken(data.ciphertext, userId);
}
export async function saveSettings(userId: string, token: string | undefined, chatId: string) {
  const actual = token || await storedToken(userId);
  const verified = await verifyDestination(actual, chatId);
  const ciphertext = await encryptToken(actual, userId);
  const { error } = await supabaseAdmin.rpc('save_verified_telegram_config', { p_user_id: userId, p_bot_id: verified.botId, p_username: verified.username, p_chat_id: chatId, p_title: verified.title, p_ciphertext: ciphertext });
  if (error) throw new Error(error.code === '23505' ? 'הבוט כבר מחובר לחשבון אחר' : 'שמירת החיבור נכשלה');
  return verified;
}
export async function generateReport(client: SupabaseClient<Database>, userId: string, period: { start: string; end: string }, details = false) {
  // SQL owner predicate, plus current vehicle access. Actor identity is never the filter.
  const events: Database['public']['Tables']['vehicle_audit_events']['Row'][] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('vehicle_audit_events').select('*').eq('owner_at_event', userId).gte('occurred_at', period.start).lt('occurred_at', period.end).order('occurred_at').order('id').range(offset, offset + 499);
    if (error) throw new Error('קריאת השינויים נכשלה');
    events.push(...data); if (data.length < 500) break;
  }
  const owners = new Map<string, string | null>();
  const ids = [...new Set(events.map(e => e.vehicle_id))];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabaseAdmin.from('vehicles').select('id,user_id').in('id', ids.slice(i, i + 100));
    if (error) throw new Error('בדיקת בעלות נכשלה');
    for (const v of data) owners.set(v.id, v.user_id);
  }
  const allowed = eligibleEvents(events, userId, owners, period.start, period.end);
  const counts = summarize(allowed);
  return { period, counts, message: reportMessage(period, counts), events: details ? allowed : [] };
}
export async function safeTest(userId: string) {
  const { data, error } = await supabaseAdmin.from('telegram_settings').select('*').eq('user_id', userId).single();
  if (error || !data?.connection_verified) throw new Error('נדרש חיבור מאומת');
  const token = await storedToken(userId);
  await verifyDestination(token, data.telegram_chat_id);
  await sendMessage(token, data.telegram_chat_id, TEST_MESSAGE);
}
export async function processDueReports() {
  const now = new Date(), latest = reportPeriod(now);
  const { data: configs, error } = await supabaseAdmin.from('telegram_settings').select('*').eq('enabled', true).eq('connection_verified', true);
  if (error) throw new Error('קריאת החיבורים נכשלה');
  let processed = 0;
  for (const config of configs ?? []) {
    if (processed >= 25) break;
    // Only periods completed since the user explicitly enabled delivery are eligible.
    if (!config.enabled_at || latest.end <= config.enabled_at) continue;
    const { data: previous } = await supabaseAdmin.from('telegram_reports').select('period_end').eq('user_id', config.user_id).order('period_end', { ascending: false }).limit(1);
    const cursor = previous?.[0]?.period_end ?? config.enabled_at;
    const period = reportPeriod(new Date(Date.parse(cursor) + 1000), true);
    if (period.end > latest.end) continue;
    const { data: id, error: claimError } = await supabaseAdmin.rpc('claim_telegram_report', { p_user_id: config.user_id, p_start: period.start, p_end: period.end });
    if (claimError || !id) continue;
    processed++;
    let sending = false;
    try {
      const report = await generateReport(supabaseAdmin, config.user_id, period);
      const token = await storedToken(config.user_id);
      await verifyDestination(token, config.telegram_chat_id);
      // Re-read configuration immediately before sending: pause, disconnect and rotation cancel stale work.
      const { data: current } = await supabaseAdmin.from('telegram_settings').select('enabled,updated_at').eq('user_id', config.user_id).single();
      if (!current?.enabled || current.updated_at !== config.updated_at) {
        await supabaseAdmin.from('telegram_reports').update({ delivery_status: 'cancelled' }).eq('id', id); continue;
      }
      const { error: writeError } = await supabaseAdmin.from('telegram_reports').update({ ...report.counts, delivery_status: 'sending', send_attempts: 1 }).eq('id', id).eq('delivery_status', 'claimed');
      if (writeError) throw new Error('שמירת ניסיון השליחה נכשלה');
      sending = true;
      const result = await sendMessage(token, config.telegram_chat_id, report.message);
      const sentAt = new Date().toISOString();
      const { error: resultError } = await supabaseAdmin.from('telegram_reports').update({ delivery_status: 'sent', telegram_message_id: result.message_id, sent_at: sentAt }).eq('id', id);
      if (resultError) throw new Error('תוצאת השליחה לא נשמרה');
      await supabaseAdmin.from('telegram_settings').update({ last_success_at: sentAt, last_error: null }).eq('user_id', config.user_id);
    } catch (error) {
      const ambiguous = error instanceof TelegramFailure ? error.ambiguous : sending;
      const message = error instanceof TelegramFailure ? error.message : ambiguous ? 'תוצאת השליחה אינה ידועה; לא תבוצע שליחה חוזרת' : 'יצירת הדוח נכשלה';
      await supabaseAdmin.from('telegram_reports').update({ delivery_status: ambiguous ? 'ambiguous' : 'failed', last_error: message }).eq('id', id);
      await supabaseAdmin.from('telegram_settings').update({ last_error: message, ...(error instanceof TelegramFailure && [401,403].includes(error.code) ? { enabled: false, connection_verified: false } : {}) }).eq('user_id', config.user_id);
    }
  }
  return { processed };
}
