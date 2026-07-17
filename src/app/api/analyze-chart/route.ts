import { db } from "@/db";
import { chartAnalyses } from "@/db/schema";
import { geminiEnabled, geminiVision } from "@/lib/ai/gemini";
import { getSession } from "@/lib/admin/auth";
import { getKlines } from "@/lib/trading/binance";
import { computeSignal, type Signal } from "@/lib/trading/signals";

export const dynamic = "force-dynamic";

type Body = {
  imageBase64?: string;
  mimeType?: string;
  symbol?: string;
  timeframe?: string;
  note?: string;
};

const PROMPT = (ctx: string) => `You are an expert crypto technical analyst.
Analyze the attached trading chart image carefully. Identify trend, chart patterns
(e.g. head & shoulders, triangles, flags), support/resistance, candlestick signals,
and momentum. ${ctx}

Respond ONLY with strict JSON (no markdown fences):
{
  "verdict": "BUY" | "SELL" | "HOLD",
  "confidence": <integer 0-100>,
  "trend": "<short>",
  "patterns": ["..."],
  "keyLevels": { "support": "<text>", "resistance": "<text>" },
  "analysis": "<2-4 sentence actionable read>",
  "risk": "<1 sentence risk note>"
}`;

function parseJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }
  if (session.role === "user" && !session.canAnalyze) {
    return Response.json(
      { error: "Chart analysis is disabled for your account" },
      { status: 403 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.imageBase64 || !body.mimeType) {
    return Response.json(
      { error: "imageBase64 and mimeType are required" },
      { status: 400 }
    );
  }

  const symbol = (body.symbol || "").toUpperCase().trim();
  const timeframe = body.timeframe || "";

  // Cross-reference with live Binance technicals when a symbol is provided.
  let techSignal: Signal | null = null;
  if (symbol) {
    try {
      const candles = await getKlines(symbol, timeframe || "1h", 300);
      techSignal = computeSignal(symbol, timeframe || "1h", candles);
    } catch {
      techSignal = null;
    }
  }

  const ctxParts: string[] = [];
  if (symbol) ctxParts.push(`The symbol is ${symbol}.`);
  if (timeframe) ctxParts.push(`Timeframe: ${timeframe}.`);
  if (techSignal) {
    ctxParts.push(
      `Live indicators say: verdict ${techSignal.verdict} (${techSignal.confidence}% conf), RSI ${techSignal.indicators.rsi?.toFixed(
        1
      )}, current price ${techSignal.price}. Factor this in but base your read primarily on the chart image.`
    );
  }
  if (body.note) ctxParts.push(`User note: ${body.note}`);

  if (!(await geminiEnabled())) {
    // Graceful fallback: return the computed technical read if we have a symbol.
    if (techSignal) {
      const analysis = `AI vision is not configured (no GEMINI_API_KEY), so this read is from live Binance technicals. ${techSignal.reasons
        .map((r) => r.detail)
        .join("; ")}.`;
      const [saved] = await db
        .insert(chartAnalyses)
        .values({
          symbol,
          timeframe: timeframe || "1h",
          verdict: techSignal.verdict,
          confidence: techSignal.confidence,
          analysis,
          indicators: techSignal.indicators,
          source: "technical",
        })
        .returning();
      return Response.json({
        result: {
          verdict: techSignal.verdict,
          confidence: techSignal.confidence,
          trend: techSignal.score > 0 ? "Bullish bias" : techSignal.score < 0 ? "Bearish bias" : "Neutral",
          patterns: [],
          keyLevels: {
            support: techSignal.levels.support.toString(),
            resistance: techSignal.levels.resistance.toString(),
          },
          analysis,
          risk: "Automated technical read only — confirm before trading.",
        },
        techSignal,
        source: "technical",
        id: saved.id,
      });
    }
    return Response.json(
      {
        error:
          "Image analysis needs GEMINI_API_KEY. Add it (free at aistudio.google.com) or pass a 'symbol' for a technical-only read.",
      },
      { status: 400 }
    );
  }

  try {
    const text = await geminiVision(
      PROMPT(ctxParts.join(" ")),
      body.imageBase64,
      body.mimeType
    );
    const parsed = parseJson(text);
    const result = parsed ?? { verdict: "HOLD", confidence: 50, analysis: text };

    const verdict = String(result.verdict ?? "HOLD").toUpperCase();
    const confidence = Number(result.confidence ?? 50);

    const [saved] = await db
      .insert(chartAnalyses)
      .values({
        symbol,
        timeframe: timeframe || "",
        verdict: ["BUY", "SELL", "HOLD"].includes(verdict) ? verdict : "HOLD",
        confidence: Number.isFinite(confidence) ? Math.round(confidence) : 50,
        analysis: String(result.analysis ?? text).slice(0, 4000),
        indicators: techSignal?.indicators ?? null,
        source: "gemini",
      })
      .returning();

    return Response.json({ result, techSignal, source: "gemini", id: saved.id });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Analysis failed" },
      { status: 502 }
    );
  }
}
