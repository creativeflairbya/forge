import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

function mask(key: string): string {
  if (key.length <= 8) return "••••";
  return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

async function guard() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// GET — list keys (masked, never returns raw value).
export async function GET() {
  const g = await guard();
  if (g) return g;
  const rows = await db.select().from(apiKeys);
  return Response.json({
    keys: rows.map((k) => ({
      id: k.id,
      provider: k.provider,
      masked: mask(k.keyValue),
      tier: k.tier,
      status: k.status,
      note: k.note,
      lastError: k.lastError,
      lastStatusCode: k.lastStatusCode,
      limitedAt: k.limitedAt,
      lastUsedAt: k.lastUsedAt,
      updatedAt: k.updatedAt,
    })),
  });
}

// POST — upsert a key for a provider.
export async function POST(req: Request) {
  const g = await guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const provider = String(body.provider ?? "").trim().toLowerCase();
  const keyValue = String(body.keyValue ?? "").trim();
  const tier = body.tier === "paid" ? "paid" : "free";
  const note = String(body.note ?? "").slice(0, 200);

  if (!["gemini", "openai", "openrouter"].includes(provider)) {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (!keyValue) {
    return Response.json({ error: "Key value required" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.provider, provider));

  if (existing) {
    await db
      .update(apiKeys)
      .set({
        keyValue,
        tier,
        note,
        status: "active",
        lastError: "",
        limitedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.provider, provider));
  } else {
    await db
      .insert(apiKeys)
      .values({ provider, keyValue, tier, note, status: "active" });
  }
  return Response.json({ ok: true });
}

// DELETE — remove a provider key.  ?provider=gemini
export async function DELETE(req: Request) {
  const g = await guard();
  if (g) return g;
  const provider = new URL(req.url).searchParams.get("provider")?.toLowerCase();
  if (!provider) return Response.json({ error: "provider required" }, { status: 400 });
  await db.delete(apiKeys).where(eq(apiKeys.provider, provider));
  return Response.json({ ok: true });
}
