import { getApiKey } from "@/lib/secrets";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSchema } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

// Public, non-sensitive status of the vision provider chain: which provider
// will handle the next chart analysis. No key material is ever returned.
export async function GET() {
  await ensureSchema();

  async function providerState(p: "openrouter" | "gemini" | "anthropic") {
    const key = await getApiKey(p);
    if (!key) return { provider: p, configured: false, status: "no-key" };
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.provider, p));
    return {
      provider: p,
      configured: true,
      status: row?.status ?? "active", // active | limited | invalid
    };
  }

  const openrouter = await providerState("openrouter");
  const gemini = await providerState("gemini");
  const anthropic = await providerState("anthropic");

  // Which provider will actually be tried first for the next analysis?
  const active =
    openrouter.configured && openrouter.status !== "invalid"
      ? "openrouter"
      : gemini.configured && gemini.status !== "invalid"
      ? "gemini"
      : anthropic.configured && anthropic.status !== "invalid"
      ? "anthropic"
      : openrouter.configured || gemini.configured || anthropic.configured
      ? "degraded" // keys exist but all marked invalid — chain will still try
      : "none";

  return Response.json({ active, chain: [openrouter, gemini, anthropic] });
}
