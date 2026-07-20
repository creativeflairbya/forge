import { db } from "@/db";
import { apiKeys, apiUsage } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSchema } from "@/lib/bootstrap";
import { getProvider } from "@/lib/ai/providers";

/**
 * Resolve a provider API key. Priority:
 *   1. Admin-managed key in the DB vault (if active/limited).
 *   2. Environment variable fallback.
 * Returns null when no usable key exists.
 */
export async function getApiKey(provider: string): Promise<string | null> {
  try {
    await ensureSchema();
    const [row] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.provider, provider));
    if (row && row.status !== "disabled" && row.keyValue) {
      return row.keyValue;
    }
  } catch {
    // DB unavailable — fall back to env.
  }
  const envName = getProvider(provider)?.envVar;
  return envName ? process.env[envName] ?? null : null;
}

export async function hasKey(provider: string): Promise<boolean> {
  return (await getApiKey(provider)) !== null;
}

type UsageInput = {
  provider: string;
  endpoint: string;
  ok: boolean;
  statusCode?: number;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  error?: string;
};

/**
 * Record one real API call and update the key's live health status.
 * A 429 → "limited" (quota/rate). A 401/403/400 auth error → "invalid".
 */
export async function recordUsage(u: UsageInput): Promise<void> {
  try {
    await ensureSchema();
    await db.insert(apiUsage).values({
      provider: u.provider,
      endpoint: u.endpoint,
      ok: u.ok,
      statusCode: u.statusCode ?? null,
      tokensIn: u.tokensIn ?? 0,
      tokensOut: u.tokensOut ?? 0,
      latencyMs: u.latencyMs ?? 0,
      error: (u.error ?? "").slice(0, 500),
    });

    const [row] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.provider, u.provider));
    if (!row) return;

    let status = row.status;
    let limitedAt = row.limitedAt;
    if (u.ok) {
      // A successful call clears a transient limited/invalid state.
      if (status === "limited" || status === "invalid") status = "active";
      limitedAt = null;
    } else if (u.statusCode === 429) {
      status = "limited";
      limitedAt = new Date();
    } else if (
      u.statusCode === 401 ||
      u.statusCode === 403 ||
      u.statusCode === 400
    ) {
      status = "invalid";
    }

    await db
      .update(apiKeys)
      .set({
        status,
        limitedAt,
        lastError: u.ok ? "" : (u.error ?? "").slice(0, 500),
        lastStatusCode: u.statusCode ?? row.lastStatusCode,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.provider, u.provider));
  } catch {
    // Never let usage logging break the main request.
  }
}
