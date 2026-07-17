"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ProjectRow = {
  id: number;
  name: string;
  description: string;
  framework: string;
  updatedAt: string;
  fileCount: number;
};

const IDEAS = [
  "A todo app with filters and localStorage",
  "A pomodoro focus timer with a progress ring",
  "A weather app using a live API",
  "A quiz game about 2026 web tech",
  "A landing page for a SaaS called Nova",
  "A quick notes app with autosave",
  "A calculator with keyboard support",
];

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function load() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data.projects ?? []);
    setFetched(true);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.project?.id) router.push(`/projects/${data.project.id}`);
  }

  async function remove(id: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this project?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
            ◆
          </span>
          Forge
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/signals"
            className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-400/20"
          >
            ₿ Crypto Signals
          </Link>
          <a
            href="#api"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
          >
            API Docs
          </a>
          <Link
            href="/login"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
          >
            Sign in
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
          >
            🔒 Admin
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mt-14 text-center">
        <span className="inline-block rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
          Your own Cursor-level AI · 2026 stack
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl bg-gradient-to-r from-white via-indigo-200 to-fuchsia-300 bg-clip-text text-4xl font-extrabold leading-tight tracking-tight text-transparent sm:text-6xl">
          Describe an app. Get working code.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          Forge is your personal AI engineering platform. Chat, generate
          complete WebApps, preview them live, and iterate — powered by an engine
          fluent in the latest 2026 technologies.
        </p>

        {/* Prompt box */}
        <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-2xl">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) create();
            }}
            placeholder="Build me a todo app with dark mode and filters…"
            rows={3}
            className="w-full resize-none bg-transparent px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <span className="text-xs text-slate-500">⌘/Ctrl + Enter</span>
            <button
              onClick={create}
              disabled={loading || !prompt.trim()}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Forging…" : "Generate app →"}
            </button>
          </div>
        </div>

        {/* Idea chips */}
        <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
          {IDEAS.map((i) => (
            <button
              key={i}
              onClick={() => setPrompt(i)}
              className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-slate-400 hover:border-indigo-400/40 hover:text-slate-200"
            >
              {i}
            </button>
          ))}
        </div>
      </section>

      {/* Projects */}
      <section className="mt-16">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">
          Your projects
        </h2>
        {!fetched ? (
          <p className="text-slate-500">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-500">
            No projects yet — describe an app above to get started.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-indigo-400/40 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between">
                  <h3 className="pr-6 font-semibold text-slate-100">{p.name}</h3>
                  <button
                    onClick={(e) => remove(p.id, e)}
                    className="absolute right-3 top-3 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                  {p.description || "No description"}
                </p>
                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                  <span>{p.fileCount} files</span>
                  <span>·</span>
                  <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* API docs */}
      <section
        id="api"
        className="mt-20 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8"
      >
        <h2 className="text-xl font-bold">Use it as an API</h2>
        <p className="mt-2 text-slate-400">
          Forge exposes your generation engine as a clean HTTP API you can call
          from anywhere.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-slate-300">
{`curl -X POST /api/generate \\
  -H "Content-Type: application/json" \\
  -d '{ "prompt": "a pomodoro timer app" }'

// -> { message, files: [{ path, content, language }], model }`}
        </pre>
        <p className="mt-3 text-xs text-slate-500">
          Connect a real model for best results — set{" "}
          <code className="text-slate-300">GEMINI_API_KEY</code> (free at
          aistudio.google.com) or{" "}
          <code className="text-slate-300">OPENAI_API_KEY</code> (any
          OpenAI-compatible provider via{" "}
          <code className="text-slate-300">OPENAI_BASE_URL</code>). Without a key,
          the built-in Forge engine responds instantly.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="font-semibold text-slate-200">POST /api/generate</div>
            <p className="mt-1 text-xs text-slate-500">Generate a full WebApp from a prompt.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="font-semibold text-slate-200">GET /api/signals</div>
            <p className="mt-1 text-xs text-slate-500">Live crypto BUY/SELL/HOLD signals from Binance.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="font-semibold text-slate-200">POST /api/analyze-chart</div>
            <p className="mt-1 text-xs text-slate-500">Gemini reads an uploaded chart image.</p>
          </div>
        </div>
      </section>

      <footer className="mt-16 pb-10 text-center text-sm text-slate-600">
        Forge · built for the 2026 web
      </footer>
    </div>
  );
}
