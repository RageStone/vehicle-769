// Username-only login: Auth needs an email, so derive a deterministic synthetic one.
export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

export function isValidUsername(u: string): boolean {
  return /^[a-z0-9._-]{3,30}$/.test(normalizeUsername(u));
}

export function usernameToEmail(u: string): string {
  return `${normalizeUsername(u)}@users.app.local`;
}
