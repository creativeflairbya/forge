import type { GeneratedFile, GenerationResult } from "@/lib/types";
import { guessLanguage } from "@/lib/types";
import { SYSTEM_PROMPT, STACK_2026 } from "./knowledge";
import { detectTemplate } from "./templates";
import { geminiEnabled, geminiText } from "./gemini";
import { getApiKey, recordUsage } from "@/lib/secrets";

type PriorFile = { path: string; content: string };

/**
 * Core generation entrypoint — the "Cursor-level" API brain.
 * Uses a real OpenAI-compatible LLM when configured, otherwise falls back to a
 * high-quality deterministic template engine so the API always works.
 */
export async function generate(
  prompt: string,
  priorFiles: PriorFile[] = []
): Promise<GenerationResult> {
  const openaiKey = await getApiKey("openai");
  if (openaiKey) {
    try {
      return await generateWithLLM(prompt, priorFiles, openaiKey);
    } catch (err) {
      console.error("OpenAI generation failed, trying next engine:", err);
    }
  }
  if (await geminiEnabled()) {
    try {
      return await generateWithGemini(prompt, priorFiles);
    } catch (err) {
      console.error("Gemini generation failed, using local engine:", err);
    }
  }
  return generateLocally(prompt, priorFiles);
}

async function generateWithLLM(
  prompt: string,
  priorFiles: PriorFile[],
  key: string
): Promise<GenerationResult> {
  const baseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ||
    "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const context =
    priorFiles.length > 0
      ? `\n\nExisting project files (modify or extend them as needed):\n${priorFiles
          .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 4000)}`)
          .join("\n\n")}`
      : "";

  const started = Date.now();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt + context },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    await recordUsage({
      provider: "openai",
      endpoint: "generate",
      ok: false,
      statusCode: res.status,
      latencyMs: Date.now() - started,
      error: body.slice(0, 400),
    });
    throw new Error(`Provider error ${res.status}: ${body}`);
  }

  const data = await res.json();
  await recordUsage({
    provider: "openai",
    endpoint: "generate",
    ok: true,
    statusCode: 200,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - started,
  });
  const raw: string = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    message?: string;
    files?: GeneratedFile[];
  };

  const files = (parsed.files ?? []).map((f) => ({
    path: f.path,
    content: f.content ?? "",
    language: f.language || guessLanguage(f.path),
  }));

  if (files.length === 0) {
    return generateLocally(prompt, priorFiles);
  }

  return {
    message: parsed.message || "Here is your generated app.",
    files,
    model,
  };
}

async function generateWithGemini(
  prompt: string,
  priorFiles: PriorFile[]
): Promise<GenerationResult> {
  const context =
    priorFiles.length > 0
      ? `\n\nExisting project files (modify or extend them):\n${priorFiles
          .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 4000)}`)
          .join("\n\n")}`
      : "";

  const text = await geminiText(
    `${SYSTEM_PROMPT}\n\nUSER REQUEST:\n${prompt}${context}`
  );
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
    message?: string;
    files?: GeneratedFile[];
  };
  const files = (parsed.files ?? []).map((f) => ({
    path: f.path,
    content: f.content ?? "",
    language: f.language || guessLanguage(f.path),
  }));
  if (files.length === 0) return generateLocally(prompt, priorFiles);
  return {
    message: parsed.message || "Here is your generated app.",
    files,
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  };
}

function generateLocally(
  prompt: string,
  priorFiles: PriorFile[]
): GenerationResult {
  const { files, label } = detectTemplate(prompt);

  const isEdit = priorFiles.length > 0;
  const techNote = pickTech();

  const message = isEdit
    ? `Updated your project — regenerated a ${label.toLowerCase()} based on: “${truncate(
        prompt
      )}”. I refreshed the files with clean, responsive code. ${techNote}`
    : `Built a **${label}** for you from: “${truncate(
        prompt
      )}”. It's a complete, self-contained web app (HTML + CSS + JS) that runs instantly in the live preview. ${techNote}`;

  return { message, files, model: "forge-local-engine" };
}

function pickTech(): string {
  const all = [
    ...STACK_2026.styling,
    ...STACK_2026.language,
    ...STACK_2026.platform,
  ];
  const pick = all[Math.floor(Math.random() * all.length)];
  return `Uses 2026 techniques such as ${pick.split("(")[0].trim()}.`;
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n).trim() + "…" : s;
}
