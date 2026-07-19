import { getKlines, get24h, POPULAR_SYMBOLS, INTERVALS } from "@/lib/trading/binance";
import { computeSignal } from "@/lib/trading/signals";
import { getSession } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

// GET /api/signals?symbol=BTCUSDT&interval=1h
// GET /api/signals?scan=1&interval=1h   -> signals for all popular symbols
export async function GET(req: Request) {
  // Login required (set ALLOW_PUBLIC_SIGNALS=1 to open temporarily).
  if (process.env.ALLOW_PUBLIC_SIGNALS !== "1") {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Login required" }, { status: 401 });
    }
    if (session.role === "user" && !session.canSignals) {
      return Response.json(
        { error: "Signal access is disabled for your account" },
        { status: 403 }
      );
    }
  }
  const url = new URL(req.url);
  const interval = url.searchParams.get("interval") || "1h";
  if (!INTERVALS.includes(interval)) {
    return Response.json({ error: "Invalid interval" }, { status: 400 });
  }

  try {
    if (url.searchParams.get("scan")) {
      const results = await Promise.all(
        POPULAR_SYMBOLS.map(async (sym) => {
          const candles = await getKlines(sym, interval, 300);
          const sig = computeSignal(sym, interval, candles);
          return {
            symbol: sig.symbol,
            price: sig.price,
            verdict: sig.verdict,
            confidence: sig.confidence,
            score: sig.score,
          };
        })
      );
      return Response.json({ interval, signals: results });
    }

    const symbol = (url.searchParams.get("symbol") || "BTCUSDT").toUpperCase();
    const [candles, ticker] = await Promise.all([
      getKlines(symbol, interval, 300),
      get24h(symbol).catch(() => null),
    ]);
    const signal = computeSignal(symbol, interval, candles);
    return Response.json({
      signal,
      ticker,
      candles: candles.slice(-120).map((c) => ({
        t: c.openTime,
        o: c.open,
        h: c.high,
        l: c.low,
        c: c.close,
      })),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to load signals" },
      { status: 502 }
    );
  }
}
