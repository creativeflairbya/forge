"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { buildPreview } from "@/lib/preview";

type Msg = { id: number; role: string; content: string };
type FileRow = {
  id: number;
  path: string;
  content: string;
  language: string;
};
type ProjectData = {
  project: { id: number; name: string; description: string };
  messages: Msg[];
  files: FileRow[];
};

export default function Workspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<ProjectData | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) return;
    const d: ProjectData = await res.json();
    setData(d);
    if (!activeFile && d.files.length) {
      const idx =
        d.files.find((f) => f.path === "index.html")?.path ?? d.files[0].path;
      setActiveFile(idx);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length, sending]);

  // Keep the editor draft in sync with the selected file.
  useEffect(() => {
    if (!data || !activeFile) return;
    const f = data.files.find((x) => x.path === activeFile);
    setDraft(f?.content ?? "");
  }, [activeFile, data]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    // optimistic user message
    setData((prev) =>
      prev
        ? {
            ...prev,
            messages: [
              ...prev.messages,
              { id: Date.now(), role: "user", content },
            ],
          }
        : prev
    );
    const res = await fetch(`/api/projects/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSending(false);
    if (res.ok) {
      const r = await res.json();
      setData((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, r.assistantMessage],
              files: r.files,
            }
          : prev
      );
      if (!activeFile && r.files.length) {
        setActiveFile(
          r.files.find((f: FileRow) => f.path === "index.html")?.path ??
            r.files[0].path
        );
      }
    }
  }

  async function saveFile() {
    if (!data || !activeFile) return;
    const f = data.files.find((x) => x.path === activeFile);
    if (!f) return;
    setSaving(true);
    await fetch(`/api/files/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    setSaving(false);
    setData((prev) =>
      prev
        ? {
            ...prev,
            files: prev.files.map((x) =>
              x.id === f.id ? { ...x, content: draft } : x
            ),
          }
        : prev
    );
  }

  if (!data) {
    return (
      <div className="grid h-screen place-items-center text-slate-500">
        Loading workspace…
      </div>
    );
  }

  const files = data.files;
  const active = files.find((f) => f.path === activeFile);
  const dirty = active ? active.content !== draft : false;
  const previewDoc = buildPreview(files);

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-lg border border-white/10 px-2.5 py-1 text-sm text-slate-300 hover:bg-white/5"
          >
            ← Home
          </Link>
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xs">
              ◆
            </span>
            {data.project.name}
          </div>
        </div>
        <span className="text-xs text-slate-500">{files.length} files</span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Chat panel */}
        <aside className="flex w-[380px] shrink-0 flex-col border-r border-white/10">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {data.messages.map((m) => (
              <div
                key={m.id}
                className={m.role === "user" ? "text-right" : "text-left"}
              >
                <div
                  className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white"
                      : "border border-white/10 bg-white/[0.04] text-slate-200"
                  }`}
                >
                  {renderText(m.content)}
                </div>
              </div>
            ))}
            {sending && (
              <div className="text-left">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-fuchsia-400" />
                  Forge is building…
                </div>
              </div>
            )}
            <div ref={chatEnd} />
          </div>
          <div className="border-t border-white/10 p-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask Forge to change something…"
                rows={2}
                className="w-full resize-none bg-transparent px-2 py-1 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <div className="flex justify-end">
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: preview / code */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-white/10 px-3 py-2">
            {(["preview", "code"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${
                  tab === t
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
            <div className="flex-1" />
            {tab === "code" && active && (
              <button
                onClick={saveFile}
                disabled={!dirty || saving}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-40"
              >
                {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </button>
            )}
          </div>

          {tab === "preview" ? (
            files.length ? (
              <iframe
                title="preview"
                className="h-full w-full flex-1 bg-white"
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                srcDoc={previewDoc}
              />
            ) : (
              <div className="grid flex-1 place-items-center text-slate-500">
                No files yet — chat with Forge to build your app.
              </div>
            )
          ) : (
            <div className="flex min-h-0 flex-1">
              {/* file list */}
              <div className="w-56 shrink-0 overflow-y-auto border-r border-white/10 p-2">
                {files.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFile(f.path)}
                    className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                      activeFile === f.path
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/5"
                    }`}
                  >
                    {f.path}
                  </button>
                ))}
                {files.length === 0 && (
                  <p className="p-3 text-sm text-slate-500">No files yet.</p>
                )}
              </div>
              {/* editor */}
              <div className="min-w-0 flex-1">
                {active ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    spellCheck={false}
                    className="h-full w-full resize-none bg-[#0b0f19] p-4 font-mono text-sm leading-relaxed text-slate-200 outline-none"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-slate-500">
                    Select a file
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Minimal markdown: render **bold** segments.
function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
