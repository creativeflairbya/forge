"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, clearToken } from "@/lib/client";

const SYMBOLS: { v: string; l: string }[] = [
  { v: "BTCUSDT", l: "BTC/USDT — Bitcoin" },
  { v: "ETHUSDT", l: "ETH/USDT — Ethereum" },
  { v: "SOLUSDT", l: "SOL/USDT — Solana" },
  { v: "BNBUSDT", l: "BNB/USDT — BNB" },
  { v: "XRPUSDT", l: "XRP/USDT — Ripple" },
  { v: "ADAUSDT", l: "ADA/USDT — Cardano" },
  { v: "DOGEUSDT", l: "DOGE/USDT — Dogecoin" },
  { v: "AVAXUSDT", l: "AVAX/USDT — Avalanche" },
  { v: "PAXGUSDT", l: "Gold — PAXG/USDT (tracks XAU/USD)" },
  { v: "LINKUSDT", l: "LINK/USDT — Chainlink" },
  { v: "DOTUSDT", l: "DOT/USDT — Polkadot" },
  { v: "LTCUSDT", l: "LTC/USDT — Litecoin" },
  { v: "TRXUSDT", l: "TRX/USDT — Tron" },
  { v: "NEARUSDT", l: "NEAR/USDT — Near" },
  { v: "SHIBUSDT", l: "SHIB/USDT — Shiba Inu" },
  { v: "PEPEUSDT", l: "PEPE/USDT — Pepe" },
];
const INTERVALS = ["15m", "1h", "4h", "1d"];

type Reason = { name: string; verdict: string; detail: string; weight: number };
type Signal = {
  symbol: string;
  timeframe: string;
  price: number;
  verdict: "BUY" | "SELL" | "HOLD";
  confidence: number;
  score: number;
  reasons: Reason[];
  indicators: Record<string, number | null>;
  levels: { support: number; resistance: number; stop: number; target: number };
};
type Candle = { t: number; o: number; h: number; l: number; c: number };
type ScanRow = { symbol: string; price: number; verdict: string; confidence: number; score: number };

const verdictColor = (v: string) =>
  v === "BUY"
    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
    : v === "SELL"
    ? "text-rose-400 bg-rose-400/10 border-rose-400/30"
    : "text-amber-300 bg-amber-300/10 border-amber-300/30";

function fmt(n: number | null | undefined, d = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

export default function SignalsPage() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState("1h");
  const [signal, setSignal] = useState<Signal | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [scan, setScan] = useState<ScanRow[]>([]);
  const [denied, setDenied] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const loadSignal = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/signals?symbol=${symbol}&interval=${interval}`);
      if (res.status === 401) {
        clearToken(); // stale/expired token — clean it up before re-login
        router.push("/login");
        return;
      }
      const d = await res.json();
      if (res.status === 403) {
        setDenied(d.error || "Access denied");
        return;
      }
      if (d.signal) setSignal(d.signal);
      if (d.candles) setCandles(d.candles);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, router]);

  const loadScan = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/signals?scan=1&interval=${interval}`);
      const d = await res.json();
      if (d.signals) setScan(d.signals);
    } catch {}
  }, [interval]);

  // Auto-refresh the signal every 1s (NOTE: window.setInterval — the local
  // state setter `setInterval` shadows the global in this component scope).
  // An in-flight guard prevents overlapping requests from stacking up when a
  // response takes longer than one second.
  const busyRef = useRef(false);
  useEffect(() => {
    const tick = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        await loadSignal();
      } finally {
        busyRef.current = false;
      }
    };
    tick();
    const t = window.setInterval(tick, 1000);
    const onVis = () => {
      if (!document.hidden) tick(); // instant refresh when tab returns
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadSignal]);

  // Auto-refresh the market scan every 10s (16 symbols would exceed Binance
  // rate limits at 1s; the headline signal is the per-second one).
  useEffect(() => {
    loadScan();
    const t = window.setInterval(loadScan, 10000);
    return () => window.clearInterval(t);
  }, [loadScan]);

  // Live price via Binance WebSocket — with auto-reconnect and a REST
  // fallback watchdog (mobile browsers suspend sockets aggressively, which
  // froze the price after a few seconds).
  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectT: number | undefined;
    let lastMsg = Date.now();

    const connect = () => {
      if (closed) return;
      try {
        ws?.close();
      } catch {}
      ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`
      );
      ws.onmessage = (e) => {
        lastMsg = Date.now();
        try {
          const d = JSON.parse(e.data);
          if (d.p) setLivePrice(parseFloat(d.p));
        } catch {}
      };
      ws.onclose = () => {
        if (!closed) reconnectT = window.setTimeout(connect, 2000);
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {}
      };
      wsRef.current = ws;
    };
    connect();

    // Watchdog: if the socket goes quiet >10s, pull price via REST and
    // force a reconnect.
    const watchdog = window.setInterval(async () => {
      if (Date.now() - lastMsg > 10000) {
        try {
          const r = await fetch(
            `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`
          );
          const d = await r.json();
          if (d.price) setLivePrice(parseFloat(d.price));
        } catch {}
        if (!ws || ws.readyState !== WebSocket.OPEN) connect();
      }
    }, 5000);

    return () => {
      closed = true;
      window.clearInterval(watchdog);
      if (reconnectT) window.clearTimeout(reconnectT);
      try {
        ws?.close();
      } catch {}
    };
  }, [symbol]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="rounded-lg border border-white/10 px-2.5 py-1 text-sm text-slate-300 hover:bg-white/5">← Home</Link>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 text-sm">₿</span>
            Crypto Signals
          </h1>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
          Binance live · free data
        </span>
      </header>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none">
          {SYMBOLS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <div className="flex gap-1 rounded-lg border border-white/10 p-1">
          {INTERVALS.map((i) => (
            <button key={i} onClick={() => setInterval(i)} className={`rounded-md px-3 py-1 text-sm ${interval === i ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"}`}>{i}</button>
          ))}
        </div>
        <button onClick={loadSignal} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">↻ Refresh</button>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          live · refreshing every 1s{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString()}` : ""}
        </span>
        {livePrice != null && (
          <span className="ml-auto font-mono text-lg">
            <span className="text-slate-500">live </span>${fmt(livePrice, 4)}
          </span>
        )}
      </div>

      {denied && (
        <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-300">
          {denied} — contact the admin to enable signal access.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main signal */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            {loading && !signal ? (
              <p className="text-slate-500">Computing signal…</p>
            ) : signal ? (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-slate-400">{signal.symbol} · {signal.timeframe}</div>
                    <div className="mt-1 font-mono text-3xl font-bold">${fmt(signal.price, 4)}</div>
                  </div>
                  <div className={`rounded-xl border px-5 py-3 text-center ${verdictColor(signal.verdict)}`}>
                    <div className="text-2xl font-extrabold">{signal.verdict}</div>
                    <div className="text-xs opacity-80">{signal.confidence}% confidence</div>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="mt-5">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Bearish</span><span>Score {signal.score}</span><span>Bullish</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/10">
                    <div className="absolute top-0 h-2 w-0.5 bg-white/40" style={{ left: "50%" }} />
                    <div className={`absolute top-0 h-2 rounded-full ${signal.score >= 0 ? "bg-emerald-400" : "bg-rose-400"}`}
                      style={{ left: signal.score >= 0 ? "50%" : `${50 + signal.score / 2}%`, width: `${Math.abs(signal.score) / 2}%` }} />
                  </div>
                </div>

                <MiniChart candles={candles} levels={signal.levels} />

                {/* Reasons */}
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {signal.reasons.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                      <span className="text-slate-300">{r.name}: {r.detail}</span>
                      <span className={r.verdict === "bullish" ? "text-emerald-400" : r.verdict === "bearish" ? "text-rose-400" : "text-slate-500"}>
                        {r.verdict === "bullish" ? "▲" : r.verdict === "bearish" ? "▼" : "•"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Levels */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Support", signal.levels.support, "text-emerald-400"],
                    ["Resistance", signal.levels.resistance, "text-rose-400"],
                    ["Stop", signal.levels.stop, "text-amber-300"],
                    ["Target", signal.levels.target, "text-cyan-300"],
                  ].map(([label, val, cls]) => (
                    <div key={label as string} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                      <div className="text-xs text-slate-500">{label as string}</div>
                      <div className={`font-mono text-sm font-semibold ${cls as string}`}>${fmt(val as number, 4)}</div>
                    </div>
                  ))}
                </div>

                {/* Indicators */}
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="rounded border border-white/10 px-2 py-1">RSI {fmt(signal.indicators.rsi, 1)}</span>
                  <span className="rounded border border-white/10 px-2 py-1">EMA50 {fmt(signal.indicators.ema50, 2)}</span>
                  <span className="rounded border border-white/10 px-2 py-1">EMA200 {fmt(signal.indicators.ema200, 2)}</span>
                  <span className="rounded border border-white/10 px-2 py-1">MACD {fmt(signal.indicators.macdHist, 3)}</span>
                  <span className="rounded border border-white/10 px-2 py-1">ATR {fmt(signal.indicators.atr, 2)}</span>
                </div>

                <p className="mt-4 text-xs text-slate-600">
                  Educational signals from live technicals — not financial advice.
                </p>
              </>
            ) : (
              <p className="text-slate-500">No signal.</p>
            )}
          </div>

          <ChartAnalyzer symbol={symbol} timeframe={interval} />
        </div>

        {/* Scanner */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Market scan · {interval}</h2>
          {scan.map((r) => (
            <button key={r.symbol} onClick={() => setSymbol(r.symbol)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-white/20">
              <div>
                <div className="font-semibold">{r.symbol.replace("USDT", "")}</div>
                <div className="font-mono text-xs text-slate-500">${fmt(r.price, 4)}</div>
              </div>
              <span className={`rounded-md border px-2.5 py-1 text-xs font-bold ${verdictColor(r.verdict)}`}>{r.verdict}</span>
            </button>
          ))}
          {scan.length === 0 && <p className="text-sm text-slate-500">Scanning…</p>}
        </div>
      </div>
    </div>
  );
}

function MiniChart({ candles, levels }: { candles: Candle[]; levels: Signal["levels"] }) {
  if (candles.length < 2) return null;
  const w = 640, h = 180, pad = 4;
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const max = Math.max(...highs, levels.resistance);
  const min = Math.min(...lows, levels.support);
  const range = max - min || 1;
  const x = (i: number) => pad + (i / (candles.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / range) * (h - pad * 2);
  const cw = Math.max(1.5, (w - pad * 2) / candles.length - 1);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-5 w-full rounded-lg bg-black/30">
      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const color = up ? "#34d399" : "#fb7185";
        return (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth={1} />
            <rect x={x(i) - cw / 2} y={y(Math.max(c.o, c.c))} width={cw} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))} fill={color} />
          </g>
        );
      })}
      <line x1={0} x2={w} y1={y(levels.resistance)} y2={y(levels.resistance)} stroke="#fb7185" strokeDasharray="4 4" strokeWidth={0.7} opacity={0.6} />
      <line x1={0} x2={w} y1={y(levels.support)} y2={y(levels.support)} stroke="#34d399" strokeDasharray="4 4" strokeWidth={0.7} opacity={0.6} />
    </svg>
  );
}

type AnalyzeResult = {
  verdict?: string;
  confidence?: number;
  trend?: string;
  patterns?: string[];
  keyLevels?: { support?: string; resistance?: string };
  analysis?: string;
  risk?: string;
};

type VisionStatus = {
  active: string;
  chain: { provider: string; configured: boolean; status: string }[];
};

function ChartAnalyzer({ symbol, timeframe }: { symbol: string; timeframe: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [mime, setMime] = useState("image/png");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [vs, setVs] = useState<VisionStatus | null>(null);

  useEffect(() => {
    apiFetch("/api/vision-status")
      .then((r) => r.json())
      .then(setVs)
      .catch(() => {});
  }, []);

  function onFile(f: File) {
    setError(null);
    setMime(f.type || "image/png");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setBase64(dataUrl.split(",")[1] ?? "");
    };
    reader.readAsDataURL(f);
  }

  async function analyze() {
    if (!base64) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: mime, symbol, timeframe, note }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || "Analysis failed");
      else {
        setResult(d.result);
        setSource(d.source);
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span>🔎</span> AI Chart Analyzer
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Upload a chart screenshot — AI vision (OpenRouter → Gemini fallback chain) reads the pattern, extracts visible data, and cross-checks it with live {symbol} technicals.
      </p>

      {vs && (
        <div
          className={`mt-3 rounded-lg border p-3 text-xs ${
            vs.active === "openrouter"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : vs.active === "gemini"
              ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
              : "border-rose-400/30 bg-rose-400/10 text-rose-300"
          }`}
        >
          {vs.active === "openrouter" && (
            <>✓ Active provider: <b>OpenRouter</b> (free vision chain: Qwen2.5-VL → GLM-4.5V → Pixtral → InternVL) · Gemini on standby.</>
          )}
          {vs.active === "gemini" && (
            <>⚠ Active provider: <b>Gemini</b> (fallback). OpenRouter is {vs.chain[0].configured ? `configured but ${vs.chain[0].status}` : "not configured"} — add a free key from openrouter.ai/keys in the admin dashboard to enable the primary free vision chain.</>
          )}
          {vs.active === "anthropic" && (
            <>⚠ Active provider: <b>Anthropic Claude</b> (tertiary fallback). Add an OpenRouter key (openrouter.ai/keys, free) for the primary vision chain.</>
          )}
          {vs.active === "degraded" && (
            <>⚠ All configured vision keys are currently marked invalid — analysis will still attempt the full chain. Check keys in the admin dashboard (“Test now”).</>
          )}
          {vs.active === "none" && (
            <>✗ No vision provider configured. Add an OpenRouter key (openrouter.ai/keys, free) or Gemini key in the admin dashboard.</>
          )}
        </div>
      )}

      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/20 p-6 text-center hover:border-emerald-400/40">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="chart" className="max-h-56 rounded-lg" />
        ) : (
          <span className="text-sm text-slate-500">Click to upload a chart image (PNG/JPG)</span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note (e.g. 'is this a breakout?')"
        className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none placeholder:text-slate-600" />

      <button onClick={analyze} disabled={!base64 || busy}
        className="mt-3 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
        {busy ? "Analyzing…" : "Analyze chart"}
      </button>

      {error && <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-300">{error}</p>}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className={`rounded-lg border px-4 py-2 text-lg font-extrabold ${verdictColor(String(result.verdict))}`}>{result.verdict}</span>
            <span className="text-sm text-slate-400">{result.confidence}% confidence · {source}</span>
          </div>
          {result.trend && <p className="text-sm"><span className="text-slate-500">Trend: </span>{result.trend}</p>}
          {result.patterns && result.patterns.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.patterns.map((p, i) => <span key={i} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">{p}</span>)}
            </div>
          )}
          {result.keyLevels && (
            <p className="text-sm text-slate-300">
              <span className="text-emerald-400">S:</span> {result.keyLevels.support} · <span className="text-rose-400">R:</span> {result.keyLevels.resistance}
            </p>
          )}
          {result.analysis && <p className="text-sm leading-relaxed text-slate-200">{result.analysis}</p>}
          {result.risk && <p className="text-xs text-amber-300/80">⚠ {result.risk}</p>}
        </div>
      )}
    </div>
  );
}
