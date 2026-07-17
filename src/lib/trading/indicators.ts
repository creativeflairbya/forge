// Pure technical-analysis indicators computed from candle close/high/low.
// This is the free, self-hosted replacement for paid trading-signal SaaS.

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export type MacdPoint = {
  macd: number | null;
  signal: number | null;
  hist: number | null;
};

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MacdPoint[] {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: (number | null)[] = values.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null
      ? (emaFast[i] as number) - (emaSlow[i] as number)
      : null
  );
  // Compute signal EMA over the defined macd values, mapped back to positions.
  const firstIdx = macdLine.findIndex((v) => v != null);
  const defined = macdLine.filter((v) => v != null) as number[];
  const sig = ema(defined, signalPeriod);
  const out: MacdPoint[] = macdLine.map((m) => ({
    macd: m,
    signal: null,
    hist: null,
  }));
  if (firstIdx >= 0) {
    for (let j = 0; j < sig.length; j++) {
      const pos = firstIdx + j;
      out[pos].signal = sig[j];
      if (out[pos].macd != null && sig[j] != null) {
        out[pos].hist = (out[pos].macd as number) - (sig[j] as number);
      }
    }
  }
  return out;
}

export function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1 || mid[i] == null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    const slice = values.slice(i - period + 1, i + 1);
    const m = mid[i] as number;
    const variance =
      slice.reduce((a, b) => a + (b - m) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(m + mult * sd);
    lower.push(m - mult * sd);
  }
  return { mid, upper, lower };
}

export function atr(
  high: number[],
  low: number[],
  close: number[],
  period = 14
): (number | null)[] {
  const tr: number[] = [];
  for (let i = 0; i < close.length; i++) {
    if (i === 0) {
      tr.push(high[i] - low[i]);
      continue;
    }
    tr.push(
      Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1])
      )
    );
  }
  return ema(tr, period);
}

export function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}
