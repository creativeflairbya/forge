// OpenRouter vision client — PRIMARY provider for chart image analysis.
//
// Free vision models are tried in the priority order below. If a model is
// unavailable (404/410), rate-limited (429), or its free quota is exhausted,
// the next model is tried automatically. The first working model is cached
// for the process lifetime. Model IDs on OpenRouter rotate over time, so the
// chain includes both the requested models and currently-listed free vision
// fallbacks — unavailable entries are skipped harmlessly.
//
// Override order without code changes: set OPENROUTER_VISION_MODELS to a
// comma-separated list of model IDs.

import { getApiKey, hasKey, recordUsage } from "@/lib/secrets";

const OR_BASE = "https://openrouter.ai/api/v1";

// Priority: Qwen2.5-VL → GLM-4.5V → Pixtral → InternVL → current free extras.
const DEFAULT_VISION_MODELS = [
  "qwen/qwen2.5-vl-72b-instruct:free",
  "qwen/qwen-2.5-vl-7b-instruct:free",
  "z-ai/glm-4.5v:free",
  "z-ai/glm-4.5v",
  "mistralai/pixtral-12b:free",
  "opengvlab/internvl3-14b:free",
  // Currently-listed free vision fallbacks (mid-2026 listings):
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "openrouter/free",
];

let workingModel: string | null = null;

export async function openrouterEnabled(): Promise<boolean> {
  return hasKey("openrouter");
}

function candidateList(): string[] {
  const env = process.env.OPENROUTER_VISION_MODELS;
  const base = env
    ? env.split(",").map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_VISION_MODELS];
  if (workingModel) {
    return [workingModel, ...base.filter((m) => m !== workingModel)];
  }
  return base;
}

/** Model-level failures → try next model. Anything else → real error. */
function isModelLevelError(status: number, body: string): boolean {
  if (status === 404 || status === 410) return true; // unknown/retired model
  if (status === 429) return true; // rate limit / free quota exhausted
  if (status === 402 && /:free|free/i.test(body)) return true; // free pool dry
  if (status === 400 && /model|not found|invalid/i.test(body)) return true;
  return false;
}

export async function openrouterVision(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<{ text: string; model: string }> {
  const key = await getApiKey("openrouter");
  if (!key) throw new Error("No OpenRouter API key configured");

  let lastError = "";
  let lastStatus = 0;

  for (const model of candidateList()) {
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`${OR_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://forge.local",
          "X-Title": "Forge Chart Analyzer",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2, // accuracy over creativity for chart reading
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${imageBase64}` },
                },
              ],
            },
          ],
        }),
      });
    } catch (e) {
      await recordUsage({
        provider: "openrouter",
        endpoint: `vision:${model}`,
        ok: false,
        latencyMs: Date.now() - started,
        error: e instanceof Error ? e.message : "network error",
      });
      throw e;
    }

    const latencyMs = Date.now() - started;

    if (!res.ok) {
      const body = await res.text();
      await recordUsage({
        provider: "openrouter",
        endpoint: `vision:${model}`,
        ok: false,
        statusCode: res.status,
        latencyMs,
        error: body.slice(0, 400),
      });
      if (isModelLevelError(res.status, body)) {
        if (workingModel === model) workingModel = null;
        lastError = body;
        lastStatus = res.status;
        continue; // next model in the chain
      }
      throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      // Empty response — treat as model-level failure and move on.
      lastError = "empty response";
      lastStatus = 200;
      continue;
    }

    workingModel = model;
    await recordUsage({
      provider: "openrouter",
      endpoint: `vision:${model}`,
      ok: true,
      statusCode: 200,
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
      latencyMs,
    });
    return { text: text.trim(), model };
  }

  throw new Error(
    `All OpenRouter vision models exhausted. Last error ${lastStatus}: ${lastError.slice(0, 300)}`
  );
}

/** Minimal key check for the admin "Test now" button. */
export async function openrouterKeyCheck(
  key: string
): Promise<{ ok: boolean; statusCode: number; message: string }> {
  const res = await fetch(`${OR_BASE}/auth/key`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  if (res.ok) {
    return { ok: true, statusCode: 200, message: "Key is valid." };
  }
  return {
    ok: false,
    statusCode: res.status,
    message:
      res.status === 401
        ? "Invalid or unauthorized OpenRouter key."
        : `Error ${res.status}: ${body.slice(0, 160)}`,
  };
}
