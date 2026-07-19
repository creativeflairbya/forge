import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  createUserSession,
  clearUserSession,
  getSession,
  verifyCredentials,
  createSessionCookie,
} from "@/lib/admin/auth";
import { timingSafeEqual } from "crypto";
import { ensureSchema } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

// GET — who am I?
export async function GET() {
  const session = await getSession();
  return Response.json({ session });
}

// POST — login (works for both master admin and regular users).
export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!username || !password) {
    return Response.json({ error: "Missing credentials" }, { status: 400 });
  }

  // Master admin path
  if (username === "admin") {
    const ok = await verifyCredentials("admin", password);
    if (!ok) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const token = await createSessionCookie();
    return Response.json({ ok: true, role: "admin", token });
  }

  // Regular user path
  const [u] = await db.select().from(users).where(eq(users.username, username));
  if (!u || !u.active) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const candidate = Buffer.from(hashPassword(password, u.passwordSalt), "hex");
  const stored = Buffer.from(u.passwordHash, "hex");
  if (candidate.length !== stored.length || !timingSafeEqual(candidate, stored)) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, u.id));
  const token = await createUserSession(u.id);
  return Response.json({ ok: true, role: "user", token });
}

// DELETE — logout (both cookie types).
export async function DELETE() {
  await clearUserSession();
  return Response.json({ ok: true });
}
