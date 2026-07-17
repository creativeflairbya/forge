import { isAuthenticated, changePassword, verifyCredentials } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");
  if (next.length < 8) {
    return Response.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 }
    );
  }
  const ok = await verifyCredentials("admin", current);
  if (!ok) {
    return Response.json({ error: "Current password is wrong" }, { status: 401 });
  }
  await changePassword(next);
  return Response.json({ ok: true });
}
