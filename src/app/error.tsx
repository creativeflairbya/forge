"use client";

import { useEffect } from "react";

// Friendly recovery screen instead of a raw "Internal Server Error".
// Retries once automatically (fresh sandboxes need a moment to bootstrap).
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // One automatic retry after a short delay — covers cold-start races.
    const t = setTimeout(() => reset(), 1500);
    return () => clearTimeout(t);
  }, [error, reset]);

  return (
    <div className="grid min-h-screen place-items-center px-5 text-center">
      <div>
        <div className="mb-4 text-4xl">⏳</div>
        <h1 className="text-xl font-bold text-slate-100">
          Warming things up…
        </h1>
        <p className="mt-2 max-w-sm text-sm text-slate-400">
          The server hit a temporary snag (usually a cold start). Retrying
          automatically…
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Retry now
          </button>
          <a
            href="/"
            className="rounded-lg border border-white/10 px-5 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
