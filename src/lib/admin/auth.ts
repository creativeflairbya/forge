import { db } from "@/db";
import { adminConfig, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { ensureSchema } from "@/lib/bootstrap";

const COOKIE = "forge_admin";
const USER_COOKIE = "forge_user";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

// Fixed bootstrap password so a fresh database is always accessible.
// CHANGE IT from the admin dashboard after logging in.
export const DEFAULT_ADMIN_PASSWORD = "ForgeMaster@2026";

async function getConfig(key: string): Promise<string | null> {
  await ensureSchema();
  const [row] = await db
    .select()
    .from(adminConfig)
    .where(eq(adminConfig.configKey, key));
  return row?.configValue ?? null;
}

// Atomic upsert — concurrent requests on a fresh database previously raced
// (duplicate-key crashes → transient 500s → "session couldn't be established").
async function setConfig(key: string, value: string): Promise<void> {
  await ensureSchema();
  await db
    .insert(adminConfig)
    .values({ configKey: key, configValue: value })
    .onConflictDoUpdate({
      target: adminConfig.configKey,
      set: { configValue: value, updatedAt: new Date() },
    });
}

// First-writer-wins variant for bootstrap values that must never be
// overwritten by a concurrent request (e.g. the session secret).
async function setConfigIfAbsent(key: string, value: string): Promise<string> {
  await ensureSchema();
  await db
    .insert(adminConfig)
    .values({ configKey: key, configValue: value })
    .onConflictDoNothing();
  return (await getConfig(key)) ?? value;
}

async function sessionSecret(): Promise<string> {
  const cached = await getConfig("session_secret");
  if (cached) return cached;
  // Race-safe: if two requests arrive simultaneously on a fresh DB, both end
  // up using whichever secret won the insert — never two different secrets
  // (which previously invalidated freshly issued tokens).
  return setConfigIfAbsent("session_secret", randomBytes(32).toString("hex"));
}

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

/**
 * Self-healing bootstrap: if no admin exists (fresh DB), create one with the
 * fixed default password so the dashboard is always reachable.
 */
export async function ensureAdmin(): Promise<void> {
  const existing = await getConfig("password_hash");
  if (existing) return;
  // Deterministic bootstrap values: if two requests race on a fresh DB they
  // write IDENTICAL salt+hash, so no mismatched pair can ever be stored
  // (a mismatched pair made login impossible → the "session couldn't be
  // established" symptom). Random salt is used once the password is changed.
  const salt = createHmac("sha256", "forge-bootstrap")
    .update(DEFAULT_ADMIN_PASSWORD)
    .digest("hex")
    .slice(0, 32);
  await setConfigIfAbsent("admin_username", "admin");
  await setConfigIfAbsent("password_salt", salt);
  await setConfigIfAbsent(
    "password_hash",
    hashPassword(DEFAULT_ADMIN_PASSWORD, salt)
  );
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  await ensureAdmin();
  const storedUser = (await getConfig("admin_username")) ?? "admin";
  const salt = await getConfig("password_salt");
  const hash = await getConfig("password_hash");
  if (!salt || !hash) return false;
  if (username !== storedUser) return false;
  const candidate = hashPassword(password, salt);
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function changePassword(newPassword: string): Promise<void> {
  const salt = randomBytes(16).toString("hex");
  await setConfig("password_salt", salt);
  await setConfig("password_hash", hashPassword(newPassword, salt));
}

export async function isDefaultPassword(): Promise<boolean> {
  const salt = await getConfig("password_salt");
  const hash = await getConfig("password_hash");
  if (!salt || !hash) return true;
  return hashPassword(DEFAULT_ADMIN_PASSWORD, salt) === hash;
}

async function sign(payload: string): Promise<string> {
  const secret = await sessionSecret();
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function setSigned(cookieName: string, payload: string): Promise<void> {
  const sig = await sign(payload);
  const jar = await cookies();
  jar.set(cookieName, `${payload}.${sig}`, {
    httpOnly: true,
    secure: true,
    // "none" is required: the preview runs inside a cross-site iframe, and
    // Lax cookies are silently dropped there → instant logout after login.
    sameSite: "none",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

async function verifyValue(value: string | null | undefined): Promise<string[] | null> {
  if (!value) return null;
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return null;
  const payload = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = await sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload.split(".");
}

/**
 * Read a session from the cookie OR the x-forge-session header.
 * The header fallback is essential: mobile Safari and embedded iframe
 * previews block third-party cookies entirely, which previously caused
 * "login works for a second then bounces back to the login page".
 */
async function readSigned(cookieName: string): Promise<string[] | null> {
  const jar = await cookies();
  const fromCookie = await verifyValue(jar.get(cookieName)?.value);
  if (fromCookie) return fromCookie;
  const h = await headers();
  return verifyValue(h.get("x-forge-session"));
}

/* ---------- admin session ---------- */

// Returns the token so clients can also store it in localStorage and send it
// via the x-forge-session header when cookies are blocked.
export async function createSessionCookie(): Promise<string> {
  const payload = `admin.${Date.now() + SESSION_TTL_MS}`;
  await setSigned(COOKIE, payload);
  return `${payload}.${await sign(payload)}`;
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  // Check both the admin cookie and the shared header token.
  const parts = await readSigned(COOKIE);
  if (!parts || parts.length !== 2) return false;
  const [who, expiry] = parts;
  return who === "admin" && Number(expiry) > Date.now();
}

/* ---------- user session ---------- */

export async function createUserSession(userId: number): Promise<string> {
  const payload = `user.${userId}.${Date.now() + SESSION_TTL_MS}`;
  await setSigned(USER_COOKIE, payload);
  return `${payload}.${await sign(payload)}`;
}

export async function clearUserSession(): Promise<void> {
  (await cookies()).delete(USER_COOKIE);
}

export type SessionInfo =
  | { role: "admin" }
  | {
      role: "user";
      id: number;
      username: string;
      canSignals: boolean;
      canAnalyze: boolean;
      canGenerate: boolean;
    }
  | null;

export async function getSession(): Promise<SessionInfo> {
  if (await isAuthenticated()) return { role: "admin" };
  const parts = await readSigned(USER_COOKIE);
  if (!parts || parts.length !== 3 || parts[0] !== "user") return null;
  const [, idStr, expiry] = parts;
  if (Number(expiry) < Date.now()) return null;
  const id = Number(idStr);
  if (!Number.isInteger(id)) return null;
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u || !u.active) return null;
  return {
    role: "user",
    id: u.id,
    username: u.username,
    canSignals: u.canSignals,
    canAnalyze: u.canAnalyze,
    canGenerate: u.canGenerate,
  };
}
