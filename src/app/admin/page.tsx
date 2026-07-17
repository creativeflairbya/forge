"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type KeyRow = {
  id: number;
  provider: string;
  masked: string;
  tier: string;
  status: string;
  note: string;
  lastError: string;
  lastStatusCode: number | null;
  limitedAt: string | null;
  lastUsedAt: string | null;
  updatedAt: string;
};
type Totals = {
  provider: string;
  calls: number;
  ok: number;
  errors: number;
  tokensIn: number;
  tokensOut: number;
  avgLatency: number;
};
type Last24 = { provider: string; calls: number; errors: number; rateLimited: number };
type UsageRow = {
  id: number;
  provider: string;
  endpoint: string;
  ok: boolean;
  statusCode: number | null;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  error: string;
  createdAt: string;
};

const statusStyle = (s: string) =>
  s === "active"
    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
    : s === "limited"
    ? "text-amber-300 bg-amber-300/10 border-amber-300/30"
    : s === "invalid"
    ? "text-rose-400 bg-rose-400/10 border-rose-400/30"
    : "text-slate-400 bg-white/5 border-white/10";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");

  const [defaultPw, setDefaultPw] = useState(false);

  const checkAuth = useCallback(async () => {
    const res = await fetch("/api/admin/login");
    const d = await res.json();
    setAuthed(!!d.authenticated);
    setDefaultPw(!!d.defaultPassword);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      setPassword("");
      setAuthed(true);
    } else {
      const d = await res.json();
      setLoginErr(d.error || "Login failed");
    }
  }

  if (authed === null) {
    return <div className="grid h-screen place-items-center text-slate-500">Loading…</div>;
  }

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center px-5">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-7">
          <div className="mb-6 flex items-center gap-2 text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">🔒</span>
            Admin Login
          </div>
          <label className="mb-1 block text-xs text-slate-500">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            className="mb-4 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none" />
          <label className="mb-1 block text-xs text-slate-500">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none" />
          {loginErr && <p className="mb-3 text-sm text-rose-400">{loginErr}</p>}
          <button className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2.5 font-semibold text-white hover:brightness-110">
            Sign in
          </button>
          <Link href="/" className="mt-4 block text-center text-xs text-slate-500 hover:text-slate-300">← Back to app</Link>
        </form>
      </div>
    );
  }

  return <Dashboard onLogout={() => setAuthed(false)} defaultPw={defaultPw} />;
}

function Dashboard({ onLogout, defaultPw }: { onLogout: () => void; defaultPw: boolean }) {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [totals, setTotals] = useState<Totals[]>([]);
  const [last24, setLast24] = useState<Last24[]>([]);
  const [recent, setRecent] = useState<UsageRow[]>([]);
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});

  // key form
  const [provider, setProvider] = useState("gemini");
  const [keyValue, setKeyValue] = useState("");
  const [tier, setTier] = useState("free");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // password form
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const load = useCallback(async () => {
    const [kr, ur] = await Promise.all([
      fetch("/api/admin/keys"),
      fetch("/api/admin/usage"),
    ]);
    if (kr.status === 401 || ur.status === 401) {
      // Session expired (or new sandbox) — force re-login instead of failing silently.
      onLogout();
      return;
    }
    const k = await kr.json();
    const u = await ur.json();
    setKeys(k.keys ?? []);
    setTotals(u.totals ?? []);
    setLast24(u.last24 ?? []);
    setRecent(u.recent ?? []);
  }, [onLogout]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyValue.trim()) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, keyValue, tier, note }),
      });
      if (res.status === 401) {
        setSaveMsg("Session expired — please log in again.");
        onLogout();
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveMsg(`✗ ${d.error || "Save failed"}`);
      } else {
        setSaveMsg("✓ Key saved. Click “Test now” to verify it live.");
        setKeyValue("");
        setNote("");
        load();
      }
    } catch {
      setSaveMsg("✗ Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function testKey(p: string) {
    setTestMsg((m) => ({ ...m, [p]: "Testing…" }));
    const res = await fetch("/api/admin/keys/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: p }),
    });
    const d = await res.json();
    setTestMsg((m) => ({ ...m, [p]: d.message || d.error || "Done" }));
    load();
  }

  async function deleteKey(p: string) {
    if (!confirm(`Remove the ${p} key?`)) return;
    await fetch(`/api/admin/keys?provider=${p}`, { method: "DELETE" });
    load();
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    onLogout();
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg("");
    const res = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: curPw, next: newPw }),
    });
    const d = await res.json();
    setPwMsg(res.ok ? "✓ Password changed" : d.error || "Failed");
    if (res.ok) {
      setCurPw("");
      setNewPw("");
    }
  }

  const totalFor = (p: string) => totals.find((t) => t.provider === p);
  const l24For = (p: string) => last24.find((t) => t.provider === p);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">🔒</span>
          Admin · Key Vault
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">App</Link>
          <button onClick={logout} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">Log out</button>
        </div>
      </header>

      {defaultPw && (
        <div className="mb-6 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-200">
          ⚠ You are using the default admin password (<code>ForgeMaster@2026</code>). Change it below now.
        </div>
      )}

      {/* Keys */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">API Keys & live status</h2>
        <div className="grid gap-3">
          {keys.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-500">No keys stored yet — add one below.</p>
          )}
          {keys.map((k) => {
            const t = totalFor(k.provider);
            const l = l24For(k.provider);
            return (
              <div key={k.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold capitalize">{k.provider}</span>
                    <span className="font-mono text-xs text-slate-500">{k.masked}</span>
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${statusStyle(k.status)}`}>{k.status}</span>
                    <span className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-slate-400">{k.tier}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => testKey(k.provider)} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5">Test now</button>
                    <button onClick={() => deleteKey(k.provider)} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-rose-400 hover:bg-rose-400/10">Remove</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Stat label="Calls (all)" value={t ? t.calls : 0} />
                  <Stat label="Errors (all)" value={t ? t.errors : 0} danger={!!t && t.errors > 0} />
                  <Stat label="Calls 24h" value={l ? l.calls : 0} />
                  <Stat label="429s 24h" value={l ? l.rateLimited : 0} danger={!!l && l.rateLimited > 0} />
                  <Stat label="Tokens in" value={t ? t.tokensIn : 0} />
                  <Stat label="Tokens out" value={t ? t.tokensOut : 0} />
                  <Stat label="Avg latency" value={t ? `${t.avgLatency}ms` : "—"} />
                  <Stat label="Last used" value={k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleTimeString() : "never"} />
                </div>
                {k.status === "limited" && k.limitedAt && (
                  <p className="mt-2 text-xs text-amber-300">
                    ⚠ Rate/quota limit hit at {new Date(k.limitedAt).toLocaleString()}. Free quota renews on Google&apos;s schedule (per-minute & daily). Add a paid key to avoid interruptions.
                  </p>
                )}
                {k.lastError && k.status !== "active" && (
                  <p className="mt-2 truncate text-xs text-rose-400/80">Last error: {k.lastError}</p>
                )}
                {testMsg[k.provider] && (
                  <p className="mt-2 text-xs text-slate-300">Test: {testMsg[k.provider]}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Add / update key */}
        <form onSubmit={saveKey} className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="mb-3 text-sm font-semibold">Add / update a key</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none">
              <option value="gemini">Gemini (Google AI Studio)</option>
              <option value="openai">OpenAI-compatible</option>
            </select>
            <select value={tier} onChange={(e) => setTier(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none">
              <option value="free">Free tier</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <input value={keyValue} onChange={(e) => setKeyValue(e.target.value)} placeholder="Paste the API key" type="password"
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none" />
          <button disabled={saving || !keyValue.trim()} className="mt-3 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
            {saving ? "Saving…" : "Save key"}
          </button>
          {saveMsg && <p className="mt-3 text-sm text-slate-200">{saveMsg}</p>}
        </form>
      </section>

      <UsersSection />


      {/* Recent calls */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">Recent API calls (real log)</h2>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Time</th><th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Endpoint</th><th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tokens</th><th className="px-3 py-2">Latency</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">No calls logged yet.</td></tr>
              )}
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-slate-400">{new Date(r.createdAt).toLocaleTimeString()}</td>
                  <td className="px-3 py-2 capitalize">{r.provider}</td>
                  <td className="px-3 py-2 text-slate-400">{r.endpoint}</td>
                  <td className="px-3 py-2">
                    <span className={r.ok ? "text-emerald-400" : "text-rose-400"}>{r.ok ? "OK" : r.statusCode || "ERR"}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{r.tokensIn + r.tokensOut}</td>
                  <td className="px-3 py-2 text-slate-400">{r.latencyMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Change password */}
      <section className="mb-16">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">Change password</h2>
        <form onSubmit={changePw} className="max-w-sm rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="Current password"
            className="mb-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none" />
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password (min 8 chars)"
            className="mb-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none" />
          {pwMsg && <p className="mb-3 text-sm text-slate-300">{pwMsg}</p>}
          <button className="rounded-lg border border-white/10 px-5 py-2 text-sm text-slate-200 hover:bg-white/5">Update password</button>
        </form>
      </section>
    </div>
  );
}

type UserRow = {
  id: number;
  username: string;
  active: boolean;
  canSignals: boolean;
  canAnalyze: boolean;
  canGenerate: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

function UsersSection() {
  const [list, setList] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [canSignals, setCanSignals] = useState(true);
  const [canAnalyze, setCanAnalyze] = useState(false);
  const [canGenerate, setCanGenerate] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (!res.ok) return;
    const d = await res.json();
    setList(d.users ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, canSignals, canAnalyze, canGenerate }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(`✗ ${d.error || "Failed to create user"}`);
      return;
    }
    setMsg(`✓ User "${d.user.username}" created. Password: ${d.password} — share it now; it won't be shown again.`);
    setUsername("");
    setPassword("");
    load();
  }

  async function toggle(u: UserRow, field: "active" | "canSignals" | "canAnalyze" | "canGenerate") {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, [field]: !u[field] }),
    });
    load();
  }

  async function resetPw(u: UserRow) {
    if (!confirm(`Reset password for ${u.username}?`)) return;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, resetPassword: true }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.password) {
      setMsg(`✓ New password for ${u.username}: ${d.password} — share it now; it won't be shown again.`);
    }
  }

  async function removeUser(u: UserRow) {
    if (!confirm(`Delete user ${u.username}?`)) return;
    await fetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
    load();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
        Users & access control
      </h2>

      {msg && (
        <p className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          {msg}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Signals</th>
              <th className="px-3 py-2">Chart AI</th>
              <th className="px-3 py-2">Generate</th>
              <th className="px-3 py-2">Last login</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                  No users yet — create one below.
                </td>
              </tr>
            )}
            {list.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="px-3 py-2 font-semibold">{u.username}</td>
                {(["active", "canSignals", "canAnalyze", "canGenerate"] as const).map((f) => (
                  <td key={f} className="px-3 py-2">
                    <button
                      onClick={() => toggle(u, f)}
                      className={`rounded-md border px-2 py-0.5 text-xs ${
                        u[f]
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                          : "border-white/10 bg-white/5 text-slate-500"
                      }`}
                    >
                      {u[f] ? "ON" : "OFF"}
                    </button>
                  </td>
                ))}
                <td className="px-3 py-2 text-slate-400">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "never"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => resetPw(u)} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5">
                      Reset PW
                    </button>
                    <button onClick={() => removeUser(u)} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-rose-400 hover:bg-rose-400/10">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={createUser} className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="mb-3 text-sm font-semibold">Add a user</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (3-32 chars)"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password (blank = auto-generate)"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-300">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={canSignals} onChange={(e) => setCanSignals(e.target.checked)} />
            Signal access
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={canAnalyze} onChange={(e) => setCanAnalyze(e.target.checked)} />
            Chart AI analysis
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={canGenerate} onChange={(e) => setCanGenerate(e.target.checked)} />
            App generation
          </label>
        </div>
        <button
          disabled={busy || username.trim().length < 3}
          className="mt-3 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create user"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Users can sign in at <code className="text-slate-300">/login</code>. They never see API keys or this dashboard.
        </p>
      </form>
    </section>
  );
}

function Stat({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`font-mono text-sm font-semibold ${danger ? "text-rose-400" : "text-slate-200"}`}>{value}</div>
    </div>
  );
}
