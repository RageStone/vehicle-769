import { z } from 'zod';
const botSchema = z.object({ id: z.number().int(), is_bot: z.literal(true), username: z.string() });
const chatSchema = z.object({ id: z.number().int(), type: z.enum(['private', 'group', 'supergroup', 'channel']), title: z.string().optional(), first_name: z.string().optional(), username: z.string().optional(), permissions: z.object({ can_send_messages: z.boolean().optional() }).optional() });
const memberSchema = z.object({ status: z.string(), can_post_messages: z.boolean().optional(), can_send_messages: z.boolean().optional(), is_member: z.boolean().optional() });
export class TelegramFailure extends Error { constructor(public code: number, public ambiguous = false) { super(code === 401 ? 'טוקן הבוט אינו תקף; החלף אותו' : code === 403 ? 'הבוט אינו מורשה לשלוח ליעד; בדוק הרשאות והתחל שיחה פרטית' : code === 429 ? 'טלגרם מגביל כרגע את השליחה' : ambiguous ? 'תוצאת השליחה אינה ידועה; לא תבוצע שליחה חוזרת אוטומטית' : 'טלגרם דחה את הבקשה; בדוק את הטוקן, היעד וההרשאות'); } }
export async function telegramCall<T>(token: string, method: string, body: Record<string, unknown>, schema: z.ZodType<T>) {
  let response: Response;
  try { response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }); }
  catch { throw new TelegramFailure(0, method === 'sendMessage'); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new TelegramFailure(response.status, method === 'sendMessage'); }
  const envelope = z.object({ ok: z.boolean(), result: z.unknown().optional(), error_code: z.number().optional() }).safeParse(payload);
  if (!envelope.success) throw new TelegramFailure(response.status, method === 'sendMessage');
  if (!response.ok || !envelope.data.ok) throw new TelegramFailure(envelope.data.error_code ?? response.status, response.status >= 500 && method === 'sendMessage');
  const result = schema.safeParse(envelope.data.result);
  if (!result.success) throw new TelegramFailure(0, method === 'sendMessage');
  return result.data;
}
export async function verifyDestination(token: string, chatId: string) {
  const bot = await telegramCall(token, 'getMe', {}, botSchema);
  const chat = await telegramCall(token, 'getChat', { chat_id: chatId }, chatSchema);
  if (String(chat.id) !== chatId) throw new Error('מזהה היעד אינו תואם');
  if (chat.type !== 'private') {
    const member = await telegramCall(token, 'getChatMember', { chat_id: chatId, user_id: bot.id }, memberSchema);
    const admin = member.status === 'creator' || member.status === 'administrator';
    if (['left', 'kicked'].includes(member.status) || (chat.type === 'channel' && !(member.status === 'creator' || (member.status === 'administrator' && member.can_post_messages === true))) || (!admin && (chat.permissions?.can_send_messages === false || (member.status === 'restricted' && (!member.is_member || !member.can_send_messages))))) throw new Error('לבוט אין הרשאת פרסום ביעד');
  }
  return { botId: bot.id, username: bot.username, chatId, title: chat.title ?? chat.first_name ?? chat.username ?? chatId, privateChat: chat.type === 'private' };
}
export const sendMessage = (token: string, chatId: string, text: string) => telegramCall(token, 'sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } }, z.object({ message_id: z.number().int() }));
