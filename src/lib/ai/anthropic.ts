// Anthropic Claude vision client — third link in the vision fallback chain.

import { getApiKey, hasKey, recordUsage } from "@/lib/secrets";

const MODELS = [
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-latest",
];

let workingModel: string | null = null;

export async function anthropicEnabled(): Promise<boolean> {
  return hasKey("anthropic");
}

export async function anthropicVision(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<{ text: string; model: string }> {
  const key = await getApiKey("anthropic");
  if (!key) throw new Error("No Anthropic API key configured");

  const list = workingModel
    ? [workingModel, ...MODELS.filter((m) => m !== workingModel)]
    : [...MODELS];

  let lastError = "";
  let lastStatus = 0;

  for (const model of list) {
    const started = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: imageBase64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      const body = await res.text();
      await recordUsage({
        provider: "anthropic",
        endpoint: `vision:${model}`,
        ok: false,
        statusCode: res.status,
        latencyMs,
        error: body.slice(0, 400),
      });
      if (res.status === 404 || (res.status === 400 && /model/i.test(body))) {
        if (workingModel === model) workingModel = null;
        lastError = body;
        lastStatus = res.status;
        continue; // retired/unknown model — try next
      }
      throw new Error(`Anthropic error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    workingModel = model;
    await recordUsage({
      provider: "anthropic",
      endpoint: `vision:${model}`,
      ok: true,
      statusCode: 200,
      tokensIn: data.usage?.input_tokens ?? 0,
      tokensOut: data.usage?.output_tokens ?? 0,
      latencyMs,
    });
    const text: string = (data.content ?? [])
      .map((c: { text?: string }) => c.text ?? "")
      .join("")
      .trim();
    return { text, model };
  }

  throw new Error(
    `All Anthropic models exhausted. Last error ${lastStatus}: ${lastError.slice(0, 200)}`
  );
}
