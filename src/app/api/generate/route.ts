import { generate } from "@/lib/ai/engine";

export const dynamic = "force-dynamic";

/**
 * Public stateless generation endpoint — your own Cursor-level API.
 *
 * POST /api/generate
 * { "prompt": "a todo app with dark mode", "files": [{ "path": "...", "content": "..." }] }
 *
 * Returns: { message, files: [{ path, content, language }], model }
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return Response.json(
      { error: "Body must include a non-empty 'prompt' string." },
      { status: 400 }
    );
  }

  const prior = Array.isArray(body.files)
    ? body.files
        .filter(
          (f: unknown): f is { path: string; content: string } =>
            !!f &&
            typeof (f as { path?: unknown }).path === "string" &&
            typeof (f as { content?: unknown }).content === "string"
        )
        .map((f: { path: string; content: string }) => ({
          path: f.path,
          content: f.content,
        }))
    : [];

  const result = await generate(body.prompt.trim(), prior);
  return Response.json(result);
}

export async function GET() {
  return Response.json({
    name: "Forge Generation API",
    version: "1.0",
    usage: "POST { prompt: string, files?: {path,content}[] }",
    poweredBy: process.env.OPENAI_API_KEY
      ? "OpenAI-compatible LLM"
      : "Forge local engine",
  });
}
