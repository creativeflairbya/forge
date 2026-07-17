import { db } from "@/db";
import { apiUsage } from "@/db/schema";
import { desc, sql, gte } from "drizzle-orm";
import { isAuthenticated } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Real aggregates grouped by provider (all-time + last 24h).
  const totals = await db
    .select({
      provider: apiUsage.provider,
      calls: sql<number>`count(*)`,
      ok: sql<number>`sum(case when ${apiUsage.ok} then 1 else 0 end)`,
      errors: sql<number>`sum(case when ${apiUsage.ok} then 0 else 1 end)`,
      tokensIn: sql<number>`coalesce(sum(${apiUsage.tokensIn}),0)`,
      tokensOut: sql<number>`coalesce(sum(${apiUsage.tokensOut}),0)`,
      avgLatency: sql<number>`coalesce(round(avg(${apiUsage.latencyMs})),0)`,
    })
    .from(apiUsage)
    .groupBy(apiUsage.provider);

  const last24 = await db
    .select({
      provider: apiUsage.provider,
      calls: sql<number>`count(*)`,
      errors: sql<number>`sum(case when ${apiUsage.ok} then 0 else 1 end)`,
      rateLimited: sql<number>`sum(case when ${apiUsage.statusCode} = 429 then 1 else 0 end)`,
    })
    .from(apiUsage)
    .where(gte(apiUsage.createdAt, dayAgo))
    .groupBy(apiUsage.provider);

  const recent = await db
    .select()
    .from(apiUsage)
    .orderBy(desc(apiUsage.createdAt))
    .limit(25);

  return Response.json({
    totals: totals.map((t) => ({
      ...t,
      calls: Number(t.calls),
      ok: Number(t.ok),
      errors: Number(t.errors),
      tokensIn: Number(t.tokensIn),
      tokensOut: Number(t.tokensOut),
      avgLatency: Number(t.avgLatency),
    })),
    last24: last24.map((t) => ({
      ...t,
      calls: Number(t.calls),
      errors: Number(t.errors),
      rateLimited: Number(t.rateLimited),
    })),
    recent,
  });
}

// Optional cleanup of old logs
export async function DELETE() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await db.delete(apiUsage);
  return Response.json({ ok: true });
}
