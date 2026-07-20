import { db } from "@/db";
import { chartAnalyses } from "@/db/schema";
import { analyzeImage, visionAvailable } from "@/lib/ai/vision";
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

const PROMPT = (ctx: string) => `You are an expert technical analyst with precise chart-reading skills.
Analyze the attached trading chart image with maximum accuracy. Work step by step:
1. OCR / DATA EXTRACTION: read every visible number and label — ticker, timeframe,
   current price, OHLC values, axis prices, indicator values (RSI, MACD, MA/EMA),
   volume figures, dates. Extract them exactly as shown.
2. TREND DETECTION: identify the primary and secondary trend (direction, strength,
   duration visible), and note any trendline breaks or channel structures.
3. PATTERNS: identify chart patterns (head & shoulders, double top/bottom,
   triangles, wedges, flags, cup & handle) and candlestick signals (engulfing,
   doji, hammer, shooting star) with their locations.
4. LEVELS: derive support/resistance from actual price levels visible on the axis.
5. SYNTHESIS: combine everything into an actionable, evidence-based read.
Prioritize accuracy over speed; only state what is actually visible. ${ctx}

Respond ONLY with strict JSON (no markdown fences):
{
  "verdict": "BUY" | "SELL" | "HOLD",
  "confidence": <integer 0-100>,
  "trend": "<primary trend + strength, short>",
  "patterns": ["<pattern with location>"],
  "keyLevels": { "support": "<price(s) from chart>", "resistance": "<price(s) from chart>" },
  "extracted": { "ticker": "<if visible>", "timeframe": "<if visible>", "price": "<if visible>", "indicators": "<visible indicator readings>" },
  "analysis": "<3-5 sentence detailed, evidence-based read citing extracted data>",
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
  // Login required (set ALLOW_PUBLIC_SIGNALS=1 to open temporarily).
  if (process.env.ALLOW_PUBLIC_SIGNALS !== "1") {
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

  if (!(await visionAvailable())) {
    // Graceful fallback: return the computed technical read if we have a symbol.
    if (techSignal) {
      const analysis = `AI vision is not configured (no OpenRouter or Gemini key), so this read is from live Binance technicals. ${techSignal.reasons
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
          "Image analysis needs an OpenRouter key (free at openrouter.ai/keys) or Gemini key — add one in the admin dashboard, or pass a 'symbol' for a technical-only read.",
      },
      { status: 400 }
    );
  }

  try {
    const vision = await analyzeImage(
      PROMPT(ctxParts.join(" ")),
      body.imageBase64,
      body.mimeType
    );
    const parsed = parseJson(vision.text);
    const result =
      parsed ?? { verdict: "HOLD", confidence: 50, analysis: vision.text };

    const verdict = String(result.verdict ?? "HOLD").toUpperCase();
    const confidence = Number(result.confidence ?? 50);
    const sourceLabel = `${vision.provider}:${vision.model}`;

    const [saved] = await db
      .insert(chartAnalyses)
      .values({
        symbol,
        timeframe: timeframe || "",
        verdict: ["BUY", "SELL", "HOLD"].includes(verdict) ? verdict : "HOLD",
        confidence: Number.isFinite(confidence) ? Math.round(confidence) : 50,
        analysis: String(result.analysis ?? vision.text).slice(0, 4000),
        indicators: techSignal?.indicators ?? null,
        source: sourceLabel,
      })
      .returning();

    return Response.json({
      result,
      techSignal,
      source: sourceLabel,
      id: saved.id,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Analysis failed";
    let friendly = raw;
    if (/429|RESOURCE_EXHAUSTED|quota|exhausted/i.test(raw)) {
      friendly =
        "All vision models are rate-limited or out of free quota right now. Free quotas renew automatically — retry in a minute, or add a paid key in the admin dashboard. Details: " +
        raw.slice(0, 200);
    } else if (/401|403|API key/i.test(raw)) {
      friendly =
        "The AI key was rejected by the provider. Open the admin dashboard and run “Test now”, or paste a fresh key (openrouter.ai/keys or aistudio.google.com).";
    }
    return Response.json({ error: friendly }, { status: 502 });
  }
}
