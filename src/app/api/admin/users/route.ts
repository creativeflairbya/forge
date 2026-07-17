import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated, hashPassword } from "@/lib/admin/auth";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

async function guard() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// GET — list users (master admin only). Never returns hashes.
export async function GET() {
  const g = await guard();
  if (g) return g;
  const rows = await db.select().from(users);
  return Response.json({
    users: rows.map((u) => ({
      id: u.id,
      username: u.username,
      active: u.active,
      canSignals: u.canSignals,
      canAnalyze: u.canAnalyze,
      canGenerate: u.canGenerate,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
  });
}

// POST — create a user. Returns the plaintext password ONCE.
export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return Response.json(
      { error: "Username: 3-32 chars, letters/numbers/._- only" },
      { status: 400 }
    );
  }
  if (username === "admin") {
    return Response.json({ error: "'admin' is reserved" }, { status: 400 });
  }
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  if (existing) {
    return Response.json({ error: "Username already exists" }, { status: 409 });
  }

  const password =
    String(body.password ?? "").length >= 8
      ? String(body.password)
      : randomBytes(8).toString("base64url");
  const salt = randomBytes(16).toString("hex");

  const [created] = await db
    .insert(users)
    .values({
      username,
      passwordSalt: salt,
      passwordHash: hashPassword(password, salt),
      canSignals: body.canSignals !== false,
      canAnalyze: body.canAnalyze === true,
      canGenerate: body.canGenerate !== false,
    })
    .returning();

  return Response.json(
    { user: { id: created.id, username: created.username }, password },
    { status: 201 }
  );
}

// PATCH — update permissions / active flag / reset password.
export async function PATCH(req: Request) {
  const g = await guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Bad id" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const k of ["active", "canSignals", "canAnalyze", "canGenerate"]) {
    if (typeof body[k] === "boolean") updates[k] = body[k];
  }

  let newPassword: string | undefined;
  if (body.resetPassword === true) {
    newPassword = randomBytes(8).toString("base64url");
    const salt = randomBytes(16).toString("hex");
    updates.passwordSalt = salt;
    updates.passwordHash = hashPassword(newPassword, salt);
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning();
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({ ok: true, password: newPassword });
}

// DELETE ?id=123
export async function DELETE(req: Request) {
  const g = await guard();
  if (g) return g;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Bad id" }, { status: 400 });
  }
  await db.delete(users).where(eq(users.id, id));
  return Response.json({ ok: true });
}
