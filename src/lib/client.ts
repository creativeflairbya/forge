// Client-side session helper.
//
// Cookies are blocked by mobile Safari and iframe previews, so the session
// token is mirrored client-side and sent on every API request via the
// x-forge-session header. The server accepts either cookie or header.
//
// Storage strategy (each layer covers the previous one failing):
//   1. localStorage    — survives reloads and new tabs
//   2. sessionStorage  — survives reloads in this tab (some private modes)
//   3. in-memory       — always works; survives client-side navigation
//      (router.push) even in strict private browsing where ALL storage
//      APIs are blocked.

const KEY = "forge_session_token";

let memToken: string | null = null;

export function saveToken(token?: string | null): void {
  if (!token) return;
  memToken = token;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, token);
  } catch {}
  try {
    sessionStorage.setItem(KEY, token);
  } catch {}
}

export function clearToken(): void {
  memToken = null;
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    try {
      const v = localStorage.getItem(KEY);
      if (v) return v;
    } catch {}
    try {
      const v = sessionStorage.getItem(KEY);
      if (v) return v;
    } catch {}
  }
  return memToken;
}

/** fetch() wrapper that always attaches the session header when present. */
export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("x-forge-session", token);
  return fetch(url, { ...init, headers });
}
