import { isAuthenticated } from "@/lib/admin/auth";
import { getApiKey, recordUsage } from "@/lib/secrets";
import { geminiText } from "@/lib/ai/gemini";
import { openrouterKeyCheck } from "@/lib/ai/openrouter";
import { getProvider } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

// POST { provider } — make one real, minimal call to verify the key works.
export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const provider = String(body.provider ?? "").toLowerCase();
  const def = getProvider(provider);
  if (!def) return Response.json({ error: "Unknown provider" }, { status: 400 });

  const key = await getApiKey(provider);
  if (!key) return Response.json({ error: "No key configured" }, { status: 400 });

  const started = Date.now();

  try {
    let ok = false;
    let statusCode = 0;
    let message = "";

    if (def.test.kind === "openrouter") {
      const r = await openrouterKeyCheck(key);
      ok = r.ok;
      statusCode = r.statusCode;
      message = r.message;
    } else if (def.test.kind === "gemini") {
      try {
        await geminiText("Reply with: ok");
        ok = true;
        statusCode = 200;
        message = "Key is valid and responding.";
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        statusCode = Number(/error (\d{3})/.exec(msg)?.[1] ?? 502);
        message = summarize(statusCode, msg);
      }
    } else if (def.test.kind === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      });
      ok = res.ok;
      statusCode = res.status;
      message = res.ok
        ? "Key is valid."
        : summarize(res.status, await res.text());
    } else {
      // Generic OpenAI-compatible: GET {baseUrl}/models with Bearer auth.
      const res = await fetch(`${def.test.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      ok = res.ok;
      statusCode = res.status;
      message = res.ok
        ? "Key is valid."
        : summarize(res.status, await res.text());
    }

    await recordUsage({
      provider,
      endpoint: "test",
      ok,
      statusCode,
      latencyMs: Date.now() - started,
      error: ok ? "" : message,
    });
    return Response.json({ ok, statusCode, latencyMs: Date.now() - started, message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    await recordUsage({
      provider,
      endpoint: "test",
      ok: false,
      latencyMs: Date.now() - started,
      error: msg,
    });
    return Response.json({ ok: false, statusCode: 0, message: msg });
  }
}

function summarize(status: number, body: string): string {
  if (status === 429) return "Rate limited / quota exceeded (429).";
  if (status === 401 || status === 403)
    return "Invalid or unauthorized key — the provider rejected it.";
  if (status === 400) return `Bad request (400): ${body.slice(0, 160)}`;
  return `Error ${status}: ${body.slice(0, 160)}`;
}
