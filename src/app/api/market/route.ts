import { NextResponse } from 'next/server';
import { safeJson } from '@/lib/utils';

function sanitizeSymbol(symbol: string) {
  return symbol.replace(/[\/\-\s]/g, '').toUpperCase();
}

function extractHistory(data: any) {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.values)) {
    return data.values;
  }

  if (Array.isArray(data.candles)) {
    return data.candles;
  }

  if (Array.isArray(data.history)) {
    return data.history;
  }

  if (Array.isArray(data.prices)) {
    return data.prices;
  }

  if (Array.isArray(data.result)) {
    return data.result;
  }

  return [];
}

function normalizeQuote(item: any) {
  if (!item) return null;

  if (Array.isArray(item)) {
    const [time, open, high, low, close] = item;
    return {
      open,
      high,
      low,
      close,
      time,
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
  const limitValue = Number(searchParams.get('limit') || '10');
  const limit = Number.isNaN(limitValue) ? 10 : Math.min(Math.max(limitValue, 1), 50);
  const apiUrl = process.env.MARKET_DATA_PROVIDER_URL;
  const apiKey = process.env.MARKET_DATA_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: 'Market data provider configuration is missing.' }, { status: 500 });
  }

  const providerSymbol = sanitizeSymbol(symbol);
  const url = apiUrl
    .replace('{symbol}', encodeURIComponent(providerSymbol))
    .replace('{period}', encodeURIComponent(period))
    .replace('{limit}', encodeURIComponent(String(limit)))
    .replace('{apikey}', encodeURIComponent(apiKey));

  try {
    const response = await fetch(url);
    const data = await safeJson(response);
    const rawHistory = extractHistory(data);
    const normalized = rawHistory
      .map(normalizeQuote)
      .filter((item): item is { open: number; high: number; low: number; close: number; time: any } => !!item && item.close !== undefined && item.open !== undefined)
      .slice(-limit)
      .map((item) => ({
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        time: item.time ? new Date(item.time).toISOString() : new Date().toISOString(),
      }));

    if (!normalized.length) {
      return NextResponse.json({
        error: 'Unable to parse market data from provider response.',
        provider: { url, data: Array.isArray(data) ? data.slice(-3) : undefined },
      }, { status: 502 });
    }

    const candle = normalized[normalized.length - 1];
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
      candles: normalized,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Market data fetch failed.', detail: String(error) }, { status: 502 });
  }
}
