import type { Candle } from "./binance";
import { ema, rsi, macd, bollinger, atr, last } from "./indicators";

export type SignalReason = {
  name: string;
  verdict: "bullish" | "bearish" | "neutral";
  detail: string;
  weight: number;
};

export type Signal = {
  symbol: string;
  timeframe: string;
  price: number;
  verdict: "BUY" | "SELL" | "HOLD";
  confidence: number; // 0-100
  score: number; // -100..100
  reasons: SignalReason[];
  indicators: {
    rsi: number | null;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHist: number | null;
    bbUpper: number | null;
    bbLower: number | null;
    atr: number | null;
  };
  levels: { support: number; resistance: number; stop: number; target: number };
};

export function computeSignal(
  symbol: string,
  timeframe: string,
  candles: Candle[]
): Signal {
  const close = candles.map((c) => c.close);
  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const price = last(close);

  const rsiArr = rsi(close, 14);
  const ema20 = ema(close, 20);
  const ema50 = ema(close, 50);
  const ema200 = ema(close, 200);
  const macdArr = macd(close);
  const bb = bollinger(close, 20, 2);
  const atrArr = atr(high, low, close, 14);

  const rsiV = last(rsiArr);
  const e20 = last(ema20);
  const e50 = last(ema50);
  const e200 = last(ema200);
  const m = last(macdArr);
  const bbU = last(bb.upper);
  const bbL = last(bb.lower);
  const atrV = last(atrArr);

  const reasons: SignalReason[] = [];
  let score = 0;

  // 1. RSI
  if (rsiV != null) {
    if (rsiV < 30) {
      reasons.push({ name: "RSI", verdict: "bullish", weight: 20, detail: `RSI ${rsiV.toFixed(1)} — oversold` });
      score += 20;
    } else if (rsiV > 70) {
      reasons.push({ name: "RSI", verdict: "bearish", weight: 20, detail: `RSI ${rsiV.toFixed(1)} — overbought` });
      score -= 20;
    } else {
      const tilt = (50 - rsiV) / 5;
      reasons.push({ name: "RSI", verdict: rsiV < 50 ? "bullish" : "bearish", weight: 6, detail: `RSI ${rsiV.toFixed(1)} — neutral zone` });
      score += Math.max(-6, Math.min(6, tilt));
    }
  }

  // 2. MACD
  if (m.macd != null && m.signal != null) {
    if (m.macd > m.signal) {
      reasons.push({ name: "MACD", verdict: "bullish", weight: 22, detail: "MACD above signal line" });
      score += 22;
    } else {
      reasons.push({ name: "MACD", verdict: "bearish", weight: 22, detail: "MACD below signal line" });
      score -= 22;
    }
  }

  // 3. EMA trend (price vs EMA50 / EMA200 golden-death cross)
  if (e50 != null && e200 != null) {
    if (e50 > e200 && price > e50) {
      reasons.push({ name: "Trend", verdict: "bullish", weight: 24, detail: "Price > EMA50 > EMA200 (uptrend)" });
      score += 24;
    } else if (e50 < e200 && price < e50) {
      reasons.push({ name: "Trend", verdict: "bearish", weight: 24, detail: "Price < EMA50 < EMA200 (downtrend)" });
      score -= 24;
    } else {
      reasons.push({ name: "Trend", verdict: "neutral", weight: 8, detail: "Mixed EMA structure" });
    }
  }

  // 4. Short EMA momentum
  if (e20 != null) {
    if (price > e20) {
      reasons.push({ name: "Momentum", verdict: "bullish", weight: 12, detail: "Price above EMA20" });
      score += 12;
    } else {
      reasons.push({ name: "Momentum", verdict: "bearish", weight: 12, detail: "Price below EMA20" });
      score -= 12;
    }
  }

  // 5. Bollinger position
  if (bbU != null && bbL != null) {
    if (price <= bbL) {
      reasons.push({ name: "Bollinger", verdict: "bullish", weight: 14, detail: "Price at/below lower band" });
      score += 14;
    } else if (price >= bbU) {
      reasons.push({ name: "Bollinger", verdict: "bearish", weight: 14, detail: "Price at/above upper band" });
      score -= 14;
    } else {
      reasons.push({ name: "Bollinger", verdict: "neutral", weight: 4, detail: "Price within bands" });
    }
  }

  const clamped = Math.max(-100, Math.min(100, score));
  let verdict: Signal["verdict"] = "HOLD";
  if (clamped >= 25) verdict = "BUY";
  else if (clamped <= -25) verdict = "SELL";

  const confidence = Math.round(Math.min(95, 40 + Math.abs(clamped) * 0.55));

  // Simple support/resistance from recent swing + ATR-based stop/target.
  const lookback = close.slice(-30);
  const support = Math.min(...low.slice(-30));
  const resistance = Math.max(...high.slice(-30));
  const a = atrV ?? ((resistance - support) / 10 || price * 0.01);
  const stop = verdict === "SELL" ? price + a * 1.5 : price - a * 1.5;
  const target = verdict === "SELL" ? price - a * 3 : price + a * 3;
  void lookback;

  return {
    symbol: symbol.toUpperCase(),
    timeframe,
    price,
    verdict,
    confidence,
    score: Math.round(clamped),
    reasons,
    indicators: {
      rsi: rsiV,
      ema20: e20,
      ema50: e50,
      ema200: e200,
      macd: m.macd,
      macdSignal: m.signal,
      macdHist: m.hist,
      bbUpper: bbU,
      bbLower: bbL,
      atr: atrV,
    },
    levels: { support, resistance, stop, target },
  };
}
