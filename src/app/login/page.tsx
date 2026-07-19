"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, saveToken, clearToken } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    clearToken(); // drop any stale token from an older session/sandbox
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || "Login failed");
        return;
      }
      const d = await res.json();
      saveToken(d.token); // survives blocked cookies (mobile Safari/iframes)

      // Verify the session round-trips before redirecting — but retry on
      // transient failures (cold starts) and only block when the server
      // EXPLICITLY rejects the fresh token repeatedly.
      let established = false;
      let explicitRejections = 0;
      for (let i = 0; i < 3; i++) {
        try {
          const check = await apiFetch("/api/auth");
          if (check.ok) {
            const who = await check.json();
            if (who.session) {
              established = true;
              break;
            }
            explicitRejections++;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!established && explicitRejections >= 3) {
        setErr(
          "This browser is rejecting the session repeatedly. Please try a normal (non-private) window, or reload and log in again."
        );
        return;
      }
      // Established, or transient hiccup — proceed; pages handle 401 safely.
      router.push(d.role === "admin" ? "/admin" : "/signals");
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <form
        onSubmit={login}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-7"
      >
        <div className="mb-6 flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
            ◆
          </span>
          Sign in to Forge
        </div>
        <label className="mb-1 block text-xs text-slate-500">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="mb-4 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none"
        />
        <label className="mb-1 block text-xs text-slate-500">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mb-4 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none"
        />
        {err && <p className="mb-3 text-sm text-rose-400">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2.5 font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-center text-xs text-slate-500">
          Accounts are created by the admin.
        </p>
        <Link
          href="/"
          className="mt-2 block text-center text-xs text-slate-500 hover:text-slate-300"
        >
          ← Back to app
        </Link>
      </form>
    </div>
  );
}
