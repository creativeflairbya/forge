import { db } from "@/db";
import { files, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSchema } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

// Save manual edits to a single file.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;
  const fileId = Number(id);
  if (!Number.isInteger(fileId))
    return Response.json({ error: "Bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.content !== "string")
    return Response.json({ error: "content required" }, { status: 400 });

  const [updated] = await db
    .update(files)
    .set({ content: body.content, updatedAt: new Date() })
    .where(eq(files.id, fileId))
    .returning();

  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, updated.projectId));

  return Response.json({ file: updated });
}
