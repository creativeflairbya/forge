import { isAuthenticated } from "@/lib/admin/auth";
import { getApiKey, recordUsage } from "@/lib/secrets";

export const dynamic = "force-dynamic";

// POST { provider } — make one real, minimal call to verify the key works.
export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const provider = String(body.provider ?? "").toLowerCase();
  const key = await getApiKey(provider as "gemini" | "openai");
  if (!key) return Response.json({ error: "No key configured" }, { status: 400 });

  const started = Date.now();

  if (provider === "gemini") {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with: ok" }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    );
    const latencyMs = Date.now() - started;
    const text = await res.text();
    await recordUsage({
      provider: "gemini",
      endpoint: "test",
      ok: res.ok,
      statusCode: res.status,
      latencyMs,
      error: res.ok ? "" : text.slice(0, 400),
    });
    return Response.json({
      ok: res.ok,
      statusCode: res.status,
      latencyMs,
      message: res.ok
        ? "Key is valid and responding."
        : summarize(res.status, text),
    });
  }

  if (provider === "openai") {
    const baseUrl =
      process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ||
      "https://api.openai.com/v1";
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const latencyMs = Date.now() - started;
    const text = await res.text();
    await recordUsage({
      provider: "openai",
      endpoint: "test",
      ok: res.ok,
      statusCode: res.status,
      latencyMs,
      error: res.ok ? "" : text.slice(0, 400),
    });
    return Response.json({
      ok: res.ok,
      statusCode: res.status,
      latencyMs,
      message: res.ok ? "Key is valid." : summarize(res.status, text),
    });
  }

  return Response.json({ error: "Unknown provider" }, { status: 400 });
}

function summarize(status: number, body: string): string {
  if (status === 429) return "Rate limited / quota exceeded (429).";
  if (status === 401 || status === 403) return "Invalid or unauthorized key.";
  if (status === 400) return `Bad request (400): ${body.slice(0, 160)}`;
  return `Error ${status}: ${body.slice(0, 160)}`;
}
