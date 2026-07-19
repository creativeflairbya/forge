// Wrapper around the Google Gemini API. Pulls the key from the admin vault
// (DB) or env, records real usage/health for every call, and automatically
// falls back across models — Google shifts free-tier quota between model
// versions (e.g. gemini-2.0-flash now has free-tier limit 0), so hardcoding
// one model breaks valid keys.

import { getApiKey, hasKey, recordUsage } from "@/lib/secrets";

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

// Tried in order. First success is cached for the process lifetime.
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-flash-latest",
];

let workingModel: string | null = null;

export async function geminiEnabled(): Promise<boolean> {
  return hasKey("gemini");
}

function candidateList(): string[] {
  const preferred = process.env.GEMINI_MODEL;
  const list = preferred
    ? [preferred, ...MODEL_CANDIDATES.filter((m) => m !== preferred)]
    : [...MODEL_CANDIDATES];
  if (workingModel) {
    return [workingModel, ...list.filter((m) => m !== workingModel)];
  }
  return list;
}

type Part =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

/** Errors that mean "this model has no quota / doesn't exist" → try next model. */
function isModelLevelError(status: number, body: string): boolean {
  if (status === 404) return true; // unknown/retired model
  if (status === 429 && /limit:\s*0|free_tier/i.test(body)) return true; // zero free quota on this model
  return false;
}

async function callGemini(parts: Part[], endpoint: string): Promise<string> {
  const key = await getApiKey("gemini");
  if (!key) throw new Error("No Gemini API key configured");

  let lastError = "";
  let lastStatus = 0;

  for (const model of candidateList()) {
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
        }),
      });
    } catch (e) {
      await recordUsage({
        provider: "gemini",
        endpoint: `${endpoint}:${model}`,
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
        provider: "gemini",
        endpoint: `${endpoint}:${model}`,
        ok: false,
        statusCode: res.status,
        latencyMs,
        error: body.slice(0, 400),
      });

      if (isModelLevelError(res.status, body)) {
        // This model has no quota for this key — try the next one.
        if (workingModel === model) workingModel = null;
        lastError = body;
        lastStatus = res.status;
        continue;
      }
      throw new Error(`Gemini error ${res.status}: ${body}`);
    }

    const data = await res.json();
    workingModel = model; // remember what works
    const usage = data.usageMetadata ?? {};
    await recordUsage({
      provider: "gemini",
      endpoint: `${endpoint}:${model}`,
      ok: true,
      statusCode: 200,
      tokensIn: usage.promptTokenCount ?? 0,
      tokensOut: usage.candidatesTokenCount ?? 0,
      latencyMs,
    });

    const text: string =
      data.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";
    return text.trim();
  }

  throw new Error(
    `All Gemini models exhausted for this key. Last error ${lastStatus}: ${lastError.slice(0, 300)}`
  );
}

export async function geminiText(prompt: string): Promise<string> {
  return callGemini([{ text: prompt }], "generate");
}

export async function geminiVision(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  return callGemini(
    [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }],
    "vision"
  );
}
