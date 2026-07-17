// Wrapper around the Google Gemini API. Pulls the key from the admin vault
// (DB) or env, and records real usage/health for every call.

import { getApiKey, hasKey, recordUsage } from "@/lib/secrets";

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

export async function geminiEnabled(): Promise<boolean> {
  return hasKey("gemini");
}

function model(): string {
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

type Part =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

async function callGemini(parts: Part[], endpoint: string): Promise<string> {
  const key = await getApiKey("gemini");
  if (!key) throw new Error("No Gemini API key configured");

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${GEMINI_BASE}/${model()}:generateContent?key=${key}`, {
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
      endpoint,
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
      endpoint,
      ok: false,
      statusCode: res.status,
      latencyMs,
      error: body.slice(0, 400),
    });
    throw new Error(`Gemini error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const usage = data.usageMetadata ?? {};
  await recordUsage({
    provider: "gemini",
    endpoint,
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
    "vision");
}
