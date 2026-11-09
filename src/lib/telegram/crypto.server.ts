// Tokens are bound to their account using authenticated additional data.
async function key() {
  const secret = process.env['TELEGRAM_ENCRYPTION_KEY'];
  if (!secret) throw new Error('הצפנת טלגרם אינה מוגדרת');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const encode = (b: Uint8Array) => btoa(Array.from(b, x => String.fromCharCode(x)).join(''));
const decode = (s: string) => Uint8Array.from(atob(s), x => x.charCodeAt(0));
export async function encryptToken(token: string, userId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) }, await key(), new TextEncoder().encode(token));
  return `v1.${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}
export async function decryptToken(ciphertext: string, userId: string) {
  const [version, iv, payload] = ciphertext.split('.');
  if (version !== 'v1' || !iv || !payload) throw new Error('שגיאת הצפנה');
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: new TextEncoder().encode(userId) }, await key(), decode(payload)));
}
