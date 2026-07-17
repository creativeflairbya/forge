// Free public Binance market data — no API key required for market endpoints.

// Public market-data mirror — not geo-restricted like api.binance.com, and needs
// no API key. Override with BINANCE_BASE_URL if desired.
const BASE = process.env.BINANCE_BASE_URL || "https://data-api.binance.vision";

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

export type Ticker24h = {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  quoteVolume: number;
};

export async function getKlines(
  symbol: string,
  interval: string,
  limit = 300
): Promise<Candle[]> {
  const url = `${BASE}/api/v3/klines?symbol=${encodeURIComponent(
    symbol.toUpperCase()
  )}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Binance klines error ${res.status}`);
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    openTime: Number(k[0]),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
    closeTime: Number(k[6]),
  }));
}

export async function get24h(symbol: string): Promise<Ticker24h> {
  const url = `${BASE}/api/v3/ticker/24hr?symbol=${encodeURIComponent(
    symbol.toUpperCase()
  )}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Binance ticker error ${res.status}`);
  const t = await res.json();
  return {
    symbol: t.symbol,
    lastPrice: parseFloat(t.lastPrice),
    priceChangePercent: parseFloat(t.priceChangePercent),
    highPrice: parseFloat(t.highPrice),
    lowPrice: parseFloat(t.lowPrice),
    quoteVolume: parseFloat(t.quoteVolume),
  };
}

export const POPULAR_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
];

export const INTERVALS = ["15m", "1h", "4h", "1d"];
