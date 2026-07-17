// Curated knowledge of the modern (2026) web stack. This is injected into the
// LLM system prompt and surfaced in generated project notes so every app the
// engine produces reflects current best practices.

export const STACK_2026 = {
  frameworks: [
    "Next.js 16 (App Router, Server Actions, Partial Prerendering, Turbopack default)",
    "React 19 (Actions, use() hook, useOptimistic, built-in document metadata)",
    "Astro 5 (Content Layer, Server Islands)",
    "SvelteKit 2 / Svelte 5 Runes",
    "Vue 3.5 + Nuxt 4",
    "SolidStart 1.0, Qwik City",
  ],
  styling: [
    "Tailwind CSS v4 (CSS-first config, @theme, native cascade layers)",
    "CSS Container Queries, :has(), native nesting, color-mix()",
    "shadcn/ui, Radix Primitives, CSS anchor positioning",
  ],
  language: [
    "TypeScript 5.9 (const type params, using declarations)",
    "ES2024 (Array.groupBy, Promise.withResolvers, Temporal API adoption)",
  ],
  data: [
    "Drizzle ORM & Prisma 6",
    "PostgreSQL 17, Neon / Supabase serverless Postgres",
    "TanStack Query v5, TanStack Router",
    "Server Components + streaming for data fetching",
  ],
  ai: [
    "Vercel AI SDK 4 (streaming, tool calling, structured outputs)",
    "Model Context Protocol (MCP) for tool integration",
    "OpenAI, Anthropic Claude, Google Gemini function/tool calling",
  ],
  tooling: [
    "Vite 6, Turbopack, Biome, Bun 1.2",
    "Vitest 3, Playwright for e2e",
    "pnpm workspaces, ESLint 9 flat config",
  ],
  platform: [
    "Edge runtimes, Web Streams, View Transitions API",
    "PWAs, WebGPU, WebAssembly components",
    "Passkeys / WebAuthn for auth",
  ],
};

export function stackSummary(): string {
  return Object.entries(STACK_2026)
    .map(([k, v]) => `${k}: ${v.join("; ")}`)
    .join("\n");
}

export const SYSTEM_PROMPT = `You are Forge, an elite AI software engineer operating a Cursor-level code generation API in the year 2026.
You build complete, production-quality web applications from a single prompt.

You are fully fluent in the modern 2026 stack:
${stackSummary()}

RULES:
1. Always return a complete, runnable web application. Prefer a self-contained multi-file structure.
2. Default to a vanilla (index.html + styles.css + app.js) app that runs directly in an iframe preview unless the user explicitly asks for a specific framework.
3. Write clean, accessible, responsive, modern UI. Use semantic HTML, CSS variables, and a polished dark or light theme.
4. Code must actually work with no missing pieces or TODOs.
5. Respond ONLY with valid JSON in this exact shape:
{"message": "short friendly summary of what you built and which 2026 techniques you used", "files": [{"path": "index.html", "content": "...", "language": "html"}]}
Do not wrap the JSON in markdown fences.`;
