import { NextResponse } from 'next/server';
import { safeJson } from '@/lib/utils';

function sanitizeSymbol(symbol: string) {
  return symbol.replace(/[\/\-\s]/g, '').toUpperCase();
}

function extractLastCandle(data: any) {
  if (!data) return null;

  if (Array.isArray(data)) {
    return data.length ? data[data.length - 1] : null;
  }

  if (Array.isArray(data.candles) && data.candles.length) {
    return data.candles[data.candles.length - 1];
  }

  if (Array.isArray(data.history) && data.history.length) {
    return data.history[data.history.length - 1];
  }

  if (Array.isArray(data.prices) && data.prices.length) {
    return data.prices[data.prices.length - 1];
  }

  if (Array.isArray(data.result) && data.result.length) {
    return data.result[data.result.length - 1];
  }

  return data;
}

function normalizeQuote(item: any) {
  if (!item) return null;

  if (Array.isArray(item)) {
    const [, open, high, low, close] = item;
    return {
      open,
      high,
      low,
      close,
      time: item[0],
    };
  }

  if (typeof item === 'object') {
    return {
      open: item.open ?? item.O ?? item.o ?? item.ask ?? item.bid,
      high: item.high ?? item.H ?? item.h,
      low: item.low ?? item.L ?? item.l,
      close: item.close ?? item.C ?? item.c ?? item.price ?? item.mid?.c ?? item.ask ?? item.bid,
      time: item.time ?? item.timestamp ?? item.date ?? item.dt,
    };
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'EUR/USD';
  const period = searchParams.get('period') || '1m';
  const limit = searchParams.get('limit') || '10';
  const apiUrl = process.env.MARKET_DATA_PROVIDER_URL;
  const apiKey = process.env.MARKET_DATA_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: 'Market data provider configuration is missing.' }, { status: 500 });
  }

  const providerSymbol = sanitizeSymbol(symbol);
  const url = apiUrl
    .replace('{symbol}', encodeURIComponent(providerSymbol))
    .replace('{period}', encodeURIComponent(period))
    .replace('{limit}', encodeURIComponent(limit))
    .replace('{apikey}', encodeURIComponent(apiKey));

  try {
    const response = await fetch(url);
    const data = await safeJson(response);
    const candle = normalizeQuote(extractLastCandle(data));

    if (!data || !candle || candle.close === undefined || candle.open === undefined) {
      return NextResponse.json({
        error: 'Unable to parse market data from provider response.',
        provider: { url, data: Array.isArray(data) ? data.slice(-3) : undefined },
      }, { status: 502 });
    }

    const price = Number(candle.close);
    const open = Number(candle.open);
    const change = open ? (((price - open) / open) * 100).toFixed(2) : '0.00';

    return NextResponse.json({
      symbol,
      price,
      change: `${change.startsWith('-') ? '' : '+'}${change}%`,
      high: candle.high !== undefined ? Number(candle.high) : price,
      low: candle.low !== undefined ? Number(candle.low) : price,
      updatedAt: candle.time ? new Date(candle.time).toLocaleTimeString() : new Date().toLocaleTimeString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Market data fetch failed.', detail: String(error) }, { status: 502 });
  }
}
