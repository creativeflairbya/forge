export type GeneratedFile = {
  path: string;
  content: string;
  language: string;
};

export type GenerationResult = {
  message: string;
  files: GeneratedFile[];
  model: string;
};

export type ChatRole = "user" | "assistant";

export function guessLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "html",
    css: "css",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
    py: "python",
    sql: "sql",
    txt: "plaintext",
  };
  return map[ext] ?? "plaintext";
}
