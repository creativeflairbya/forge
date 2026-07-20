import { isAuthenticated } from "@/lib/admin/auth";
import { getApiKey, recordUsage } from "@/lib/secrets";
import { geminiText } from "@/lib/ai/gemini";
import { openrouterKeyCheck } from "@/lib/ai/openrouter";

export const dynamic = "force-dynamic";

// POST { provider } — make one real, minimal call to verify the key works.
export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const provider = String(body.provider ?? "").toLowerCase();
  const key = await getApiKey(provider as "gemini" | "openai" | "openrouter");
  if (!key) return Response.json({ error: "No key configured" }, { status: 400 });

  const started = Date.now();

  if (provider === "gemini") {
    // Uses the same model-fallback chain as real calls, so a key that only
    // has quota on newer models is still reported as valid.
    try {
      await geminiText("Reply with: ok");
      return Response.json({
        ok: true,
        statusCode: 200,
        latencyMs: Date.now() - started,
        message: "Key is valid and responding.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      const status = /error (\d{3})/.exec(msg)?.[1];
      return Response.json({
        ok: false,
        statusCode: status ? Number(status) : 502,
        latencyMs: Date.now() - started,
        message: summarize(status ? Number(status) : 0, msg),
      });
    }
  }

  if (provider === "openrouter") {
    const result = await openrouterKeyCheck(key);
    await recordUsage({
      provider: "openrouter",
      endpoint: "test",
      ok: result.ok,
      statusCode: result.statusCode,
      latencyMs: Date.now() - started,
      error: result.ok ? "" : result.message,
    });
    return Response.json({ ...result, latencyMs: Date.now() - started });
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
