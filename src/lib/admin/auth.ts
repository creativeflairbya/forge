import { db } from "@/db";
import { adminConfig, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
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

async function setConfig(key: string, value: string): Promise<void> {
  const existing = await getConfig(key);
  if (existing === null) {
    await db.insert(adminConfig).values({ configKey: key, configValue: value });
  } else {
    await db
      .update(adminConfig)
      .set({ configValue: value, updatedAt: new Date() })
      .where(eq(adminConfig.configKey, key));
  }
}

async function sessionSecret(): Promise<string> {
  let s = await getConfig("session_secret");
  if (!s) {
    s = randomBytes(32).toString("hex");
    await setConfig("session_secret", s);
  }
  return s;
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
  const salt = randomBytes(16).toString("hex");
  await setConfig("admin_username", "admin");
  await setConfig("password_salt", salt);
  await setConfig("password_hash", hashPassword(DEFAULT_ADMIN_PASSWORD, salt));
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

async function readSigned(cookieName: string): Promise<string[] | null> {
  const jar = await cookies();
  const value = jar.get(cookieName)?.value;
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

/* ---------- admin session ---------- */

export async function createSessionCookie(): Promise<void> {
  await setSigned(COOKIE, `admin.${Date.now() + SESSION_TTL_MS}`);
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  const parts = await readSigned(COOKIE);
  if (!parts || parts.length !== 2) return false;
  const [who, expiry] = parts;
  return who === "admin" && Number(expiry) > Date.now();
}

/* ---------- user session ---------- */

export async function createUserSession(userId: number): Promise<void> {
  await setSigned(USER_COOKIE, `user.${userId}.${Date.now() + SESSION_TTL_MS}`);
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
