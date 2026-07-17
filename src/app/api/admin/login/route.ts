import {
  verifyCredentials,
  createSessionCookie,
  clearSessionCookie,
  isAuthenticated,
  ensureAdmin,
  isDefaultPassword,
} from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAdmin(); // self-heal on fresh databases
  return Response.json({
    authenticated: await isAuthenticated(),
    defaultPassword: await isDefaultPassword(),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) {
    return Response.json({ error: "Missing credentials" }, { status: 400 });
  }
  const ok = await verifyCredentials(username, password);
  if (!ok) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await createSessionCookie();
  return Response.json({ ok: true });
}

export async function DELETE() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
