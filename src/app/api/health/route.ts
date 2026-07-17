import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureSchema } from "@/lib/bootstrap";
import { ensureAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    // Self-heal fresh databases: create tables + default admin account.
    await ensureSchema();
    await ensureAdmin();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
