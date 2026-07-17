import { db } from "@/db";
import { projects, messages, files } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generate } from "@/lib/ai/engine";
import { ensureSchema } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

// Send a chat message. The AI generates/updates the app files and replies.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId))
    return Response.json({ error: "Bad id" }, { status: 400 });

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const prompt: string = (body.content ?? "").toString().trim();
  if (!prompt)
    return Response.json({ error: "Message required" }, { status: 400 });

  // Save the user turn.
  const [userMsg] = await db
    .insert(messages)
    .values({ projectId, role: "user", content: prompt })
    .returning();

  // Load current files as context for iterative edits.
  const prior = await db
    .select()
    .from(files)
    .where(eq(files.projectId, projectId));

  const result = await generate(
    prompt,
    prior.map((f) => ({ path: f.path, content: f.content }))
  );

  // Upsert generated files.
  for (const f of result.files) {
    const [existing] = await db
      .select()
      .from(files)
      .where(and(eq(files.projectId, projectId), eq(files.path, f.path)));
    if (existing) {
      await db
        .update(files)
        .set({ content: f.content, language: f.language, updatedAt: new Date() })
        .where(eq(files.id, existing.id));
    } else {
      await db.insert(files).values({
        projectId,
        path: f.path,
        content: f.content,
        language: f.language,
      });
    }
  }

  const [assistantMsg] = await db
    .insert(messages)
    .values({
      projectId,
      role: "assistant",
      content: result.message,
      meta: { model: result.model, files: result.files.map((x) => x.path) },
    })
    .returning();

  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  const fileRows = await db
    .select()
    .from(files)
    .where(eq(files.projectId, projectId));

  return Response.json({
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    files: fileRows,
  });
}
