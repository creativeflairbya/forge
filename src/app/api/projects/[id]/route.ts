import { db } from "@/db";
import { projects, messages, files } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { ensureSchema } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

async function getId(params: Promise<{ id: string }>): Promise<number | null> {
  await ensureSchema();
  const { id } = await params;
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = await getId(params);
  if (id === null) return Response.json({ error: "Bad id" }, { status: 400 });

  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.projectId, id))
    .orderBy(asc(messages.createdAt));

  const fileRows = await db
    .select()
    .from(files)
    .where(eq(files.projectId, id))
    .orderBy(asc(files.path));

  return Response.json({ project, messages: msgs, files: fileRows });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = await getId(params);
  if (id === null) return Response.json({ error: "Bad id" }, { status: 400 });
  await db.delete(projects).where(eq(projects.id, id));
  return Response.json({ ok: true });
}
