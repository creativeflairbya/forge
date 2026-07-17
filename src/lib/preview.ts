export type PreviewFile = { path: string; content: string; language: string };

/**
 * Combine generated files into a single self-contained HTML document that can
 * be rendered inside an iframe (srcDoc). Inlines local styles.css / app.js
 * references so relative links resolve inside the sandbox.
 */
export function buildPreview(files: PreviewFile[]): string {
  const byPath = new Map(files.map((f) => [f.path.replace(/^\.?\//, ""), f]));
  const html = byPath.get("index.html")?.content;

  if (!html) {
    const first = files.find((f) => f.language === "html");
    if (first) return inline(first.content, byPath);
    return `<!doctype html><html><body style="font-family:sans-serif;background:#0b0f19;color:#9aa7c2;display:grid;place-items:center;height:100vh;margin:0"><p>No index.html to preview yet.</p></body></html>`;
  }
  return inline(html, byPath);
}

function inline(html: string, byPath: Map<string, PreviewFile>): string {
  let out = html;

  // Inline <link rel="stylesheet" href="styles.css">
  out = out.replace(
    /<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi,
    (m, href: string) => {
      const f = byPath.get(href.replace(/^\.?\//, ""));
      return f ? `<style>\n${f.content}\n</style>` : m;
    }
  );

  // Inline <script src="app.js"></script>
  out = out.replace(
    /<script[^>]+src=["']([^"']+\.js)["'][^>]*><\/script>/gi,
    (m, src: string) => {
      const f = byPath.get(src.replace(/^\.?\//, ""));
      return f ? `<script>\n${f.content}\n</script>` : m;
    }
  );

  return out;
}
