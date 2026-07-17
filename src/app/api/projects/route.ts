import { db } from "@/db";
import { projects, messages, files } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { generate } from "@/lib/ai/engine";
import { ensureSchema } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

// List all projects (newest first) with file counts.
export async function GET() {
  await ensureSchema();
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      framework: projects.framework,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      fileCount: sql<number>`(select count(*) from ${files} where ${files.projectId} = ${projects.id})`,
    })
    .from(projects)
    .orderBy(desc(projects.updatedAt));
  return Response.json({ projects: rows });
}

// Create a project. If a prompt is supplied, immediately generate the app.
export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const prompt: string = (body.prompt ?? "").toString().trim();
  const name: string =
    (body.name ?? "").toString().trim() || deriveName(prompt) || "Untitled App";

  const [project] = await db
    .insert(projects)
    .values({ name, description: prompt.slice(0, 240) })
    .returning();

  if (prompt) {
    const result = await generate(prompt);
    await db.insert(messages).values({
      projectId: project.id,
      role: "user",
      content: prompt,
    });
    await db.insert(messages).values({
      projectId: project.id,
      role: "assistant",
      content: result.message,
      meta: { model: result.model, files: result.files.map((f) => f.path) },
    });
    if (result.files.length) {
      await db.insert(files).values(
        result.files.map((f) => ({
          projectId: project.id,
          path: f.path,
          content: f.content,
          language: f.language,
        }))
      );
    }
    await db
      .update(projects)
      .set({ updatedAt: new Date() })
      .where(eq(projects.id, project.id));
  }

  return Response.json({ project }, { status: 201 });
}

function deriveName(prompt: string): string {
  if (!prompt) return "";
  const words = prompt.replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
  return words.slice(0, 4).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
