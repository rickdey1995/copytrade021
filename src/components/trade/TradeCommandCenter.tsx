"use client";

import { useEffect, useState } from 'react';
import { RefreshCw, SignalLow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { safeJson } from '@/lib/utils';

const symbols = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'AUD/USD',
  'USD/CHF',
  'NZD/USD',
  'USD/CAD',
  'EUR/GBP',
  'BTC/USD',
  'ETH/USD',
  'LTC/USD',
  'XRP/USD',
  'SOL/USD',
];
const sides = ['BUY', 'SELL'];
const orderTypes = ['Market', 'Limit', 'Stop'];
const servers = ['Vantage Live 2', 'Vantage Live 1', 'Vantage Demo'];

type FollowerAccount = {
  id: string;
  name: string;
  accountId: string;
  followers: number;
  performance: string;
  equity: string;
  balance: string;
  openTrades: number;
  lastSignal: string;
  risk: string;
};

type TradeCommandCenterProps = {
  showFollowerTerminal?: boolean;
};

export function TradeCommandCenter({ showFollowerTerminal = true }: TradeCommandCenterProps) {
  const [symbol, setSymbol] = useState(symbols[0]);
  const [side, setSide] = useState(sides[0]);
  const [orderType, setOrderType] = useState(orderTypes[0]);
  const [volume, setVolume] = useState('0.01');
  const [stopLoss, setStopLoss] = useState('1.08200');
  const [takeProfit, setTakeProfit] = useState('1.09100');
  const [comment, setComment] = useState('');
  const [followerKey, setFollowerKey] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [followerAccounts, setFollowerAccounts] = useState<FollowerAccount[]>([]);
  const [status, setStatus] = useState('Ready to send MT5 signals');
  const [sending, setSending] = useState(false);
  const [endpoint, setEndpoint] = useState('/api/signals');
  const [activeServer, setActiveServer] = useState(servers[0]);
  const [connected, setConnected] = useState(false);
  const [livePrice, setLivePrice] = useState('0.00000');
  const [priceChange, setPriceChange] = useState('+0.00%');
  const [priceHigh, setPriceHigh] = useState('0.00000');
  const [priceLow, setPriceLow] = useState('0.00000');
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setEndpoint(`${window.location.origin}/api/signals`);
    }
  }, []);

  useEffect(() => {
    let cancel = false;
    const fetchLiveQuote = async () => {
      try {
        const response = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}&period=1m&limit=10`);
        const data = await safeJson(response);
        if (!cancel && response.ok && data) {
          if (data.price) setLivePrice(Number(data.price).toFixed(5));
          if (data.change) setPriceChange(data.change);
          if (data.high) setPriceHigh(Number(data.high).toFixed(5));
          if (data.low) setPriceLow(Number(data.low).toFixed(5));
          setLastUpdated(data.updatedAt || new Date().toLocaleTimeString());
        } else if (!cancel && !response.ok) {
          console.warn('Market quote fetch failed', response.status, data);
        }
      } catch (error) {
        console.warn('Market data fetch failed:', error);
      }
    };

    fetchLiveQuote();
    const interval = window.setInterval(fetchLiveQuote, 15000);
    return () => {
      cancel = true;
      window.clearInterval(interval);
    };
  }, [symbol]);

  const handleConnect = () => {
    setConnected(true);
    setStatus('Master node connected');
    setLogs((prev) => [`Connected to ${activeServer}`, ...prev]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatus('Broadcasting signal...');

    const payload = {
      id: crypto.randomUUID(),
      symbol,
      currencyPair: symbol.replace('/', ''),
      direction: side,
      action: 'OPEN',
      orderType,
      lotSize: Number(volume),
      entryPrice: 0,
      stopLoss: stopLoss ? Number(stopLoss) : 0,
      takeProfit: takeProfit ? Number(takeProfit) : 0,
      comment,
      followerKey: followerKey || null,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/signals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(response);
      if (!response.ok) {
        throw new Error(data?.message || 'Signal API error');
      }

      setLogs((prev) => [`Broadcasted ${side} ${symbol} ${volume} lots`, ...prev]);
      setStatus('Broadcast successful');
      setComment('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setLogs((prev) => [`Signal error: ${message}`, ...prev]);
      setStatus(`Broadcast failed: ${message}`);
    } finally {
      setSending(false);
    }
  };

  const handleRegisterFollower = async () => {
    if (!followerKey.trim()) return;
    try {
      const response = await fetch('/api/followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: followerKey, name: followerKey, accountId: followerKey }),
      });
      const data = await safeJson(response);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Follower registration failed');
      }
      setLogs((prev) => [`Registered follower ${followerKey}`, ...prev]);
      setFollowerKey('');
      fetchFollowers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setLogs((prev) => [`Follower registration error: ${message}`, ...prev]);
    }
  };

  const fetchFollowers = async () => {
    try {
      const response = await fetch('/api/followers', { cache: 'no-store' });
      const data = await safeJson(response);
      if (response.ok && data?.success) {
        setFollowerAccounts(data.followers || []);
      } else {
        throw new Error(data?.error || 'Unable to fetch followers');
      }
    } catch (error) {
      console.warn('Follower fetch failed:', error);
    }
  };

  useEffect(() => {
    fetchFollowers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.65fr_0.95fr]">
        <div className="space-y-6">
          <Card className="bg-[#070D18] border border-white/10 rounded-[32px] shadow-2xl shadow-black/40 overflow-hidden">
            <CardHeader className="p-6 bg-[#081421] border-b border-white/10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Vantage Setup</p>
                  <CardTitle className="text-3xl font-semibold text-white">Command Center</CardTitle>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-white/70 border border-white/10">
                  <SignalLow className="h-4 w-4 text-sky-300" /> Full MT5 Symbol Support
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/60">Vantage Login ID</Label>
                    <Input className="bg-[#0B172D] border-white/10 h-14 rounded-2xl text-white" placeholder="25448936" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/60">MT5 Password</Label>
                    <Input type="password" className="bg-[#0B172D] border-white/10 h-14 rounded-2xl text-white" placeholder="*******" />
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label className="text-white/60">Vantage Server</Label>
                    <Select value={activeServer} onValueChange={setActiveServer}>
                      <SelectTrigger className="bg-[#0B172D] border-white/10 h-14 rounded-2xl text-white px-4 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#091723] border-white/10 text-white rounded-2xl p-2">
                        {servers.map((server) => (
                          <SelectItem key={server} value={server} className="rounded-xl py-2 px-4">
                            {server}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" className={`h-14 rounded-2xl text-sm font-semibold ${connected ? 'bg-emerald-400 text-black' : 'bg-rose-500 text-white'}`} onClick={handleConnect}>
                    {connected ? 'Connected' : 'Connect Master Node'}
                  </Button>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#08131F] p-5">
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Signal Engine</p>
                <p className="mt-3 text-sm text-white/70">Live broadcast, follower sync, and currency filters for every MT5 asset.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#070D18] border border-white/10 rounded-[32px] shadow-2xl shadow-black/40 overflow-hidden">
            <CardHeader className="p-6 bg-[#081421] border-b border-white/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Trade Inputs</p>
                  <CardTitle className="text-2xl font-semibold text-white">Live order panel</CardTitle>
                </div>
                <Badge className="bg-sky-500/10 text-sky-300 border border-sky-500/20">{status}</Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-white/60">Symbol</Label>
                    <Select value={symbol} onValueChange={setSymbol}>
                      <SelectTrigger className="bg-[#0B172D] border-white/10 h-14 rounded-2xl text-white px-4 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#091723] border-white/10 text-white rounded-2xl p-2">
                        {symbols.map((item) => (
                          <SelectItem key={item} value={item} className="rounded-xl py-2 px-4">
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/60">Side</Label>
                    <Select value={side} onValueChange={setSide}>
                      <SelectTrigger className="bg-[#0B172D] border-white/10 h-14 rounded-2xl text-white px-4 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#091723] border-white/10 text-white rounded-2xl p-2">
                        {sides.map((item) => (
                          <SelectItem key={item} value={item} className="rounded-xl py-2 px-4">
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/60">Order Type</Label>
                    <Select value={orderType} onValueChange={setOrderType}>
                      <SelectTrigger className="bg-[#0B172D] border-white/10 h-14 rounded-2xl text-white px-4 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#091723] border-white/10 text-white rounded-2xl p-2">
                        {orderTypes.map((item) => (
                          <SelectItem key={item} value={item} className="rounded-xl py-2 px-4">
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/60">Lots</Label>
                    <Input value={volume} onChange={(e) => setVolume(e.target.value)} className="bg-[#0B172D] border-white/10 h-14 rounded-2xl text-white" placeholder="0.01" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-white/60">Entry</Label>
                    <Input readOnly value={livePrice} className="bg-[#0B172D] border-white/10 h-14 rounded-2xl text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/60">Stop Loss</Label>
                    <Input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className="bg-[#0B172D] border-white/10 h-14 rounded-2xl text-white" placeholder="1.08200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/60">Take Profit</Label>
                    <Input value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} className="bg-[#0B172D] border-white/10 h-14 rounded-2xl text-white" placeholder="1.09100" />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[24px] bg-[#08131F] border border-white/10 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Live Price</p>
                        <p className="mt-3 text-3xl font-semibold text-white">{livePrice}</p>
                        <p className={`mt-2 text-sm ${priceChange.startsWith('-') ? 'text-rose-300' : 'text-emerald-300'}`}>{priceChange}</p>
                        <p className="mt-1 text-xs text-white/50">Updated {lastUpdated || 'now'}</p>
                      </div>
                      <Badge className="bg-white/5 text-white/70 border border-white/10 py-2 px-3 text-sm">{orderType}</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 mt-5">
                      <div className="rounded-3xl bg-[#0B172D] p-4 text-sm text-white/80">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">High</p>
                        <p className="mt-2 text-lg font-semibold text-white">{priceHigh}</p>
                      </div>
                      <div className="rounded-3xl bg-[#0B172D] p-4 text-sm text-white/80">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">Low</p>
                        <p className="mt-2 text-lg font-semibold text-white">{priceLow}</p>
                      </div>
                      <div className="rounded-3xl bg-[#0B172D] p-4 text-sm text-white/80">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">Spread</p>
                        <p className="mt-2 text-lg font-semibold text-white">0.0002</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-[#08131F] border border-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/40">Timeframe</p>
                    <div className="mt-4 inline-flex items-center justify-between rounded-2xl bg-[#0B172D] px-4 py-3 text-white w-full">
                      <span className="text-base font-semibold">1m</span>
                      <span className="text-sm text-white/50">Live</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[24px] bg-[#08131F] border border-white/10 p-4">
                    <Label className="text-white/60">Signal Note</Label>
                    <Textarea value={comment} onChange={(e) => setComment(e.target.value)} className="mt-3 bg-[#0B172D] border-white/10 text-white rounded-3xl h-28" placeholder="Enter trade note or strategy tag" />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[24px] bg-[#08131F] border border-white/10 p-4 text-sm text-white/50">
                      <p>Bridge endpoint</p>
                      <p className="mt-2 text-white">{endpoint}</p>
                    </div>
                    <Button type="submit" className="h-14 rounded-2xl bg-sky-500 text-black font-semibold w-full" disabled={sending}>
                      {sending ? 'Broadcasting...' : 'Broadcast Signal'}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-[#070D18] border border-white/10 rounded-[32px] shadow-2xl shadow-black/40 overflow-hidden">
            <CardHeader className="p-6 bg-[#081421] border-b border-white/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Followers</p>
                  <CardTitle className="text-2xl font-semibold text-white">Register Followers</CardTitle>
                </div>
                <Badge className="bg-sky-500/10 text-sky-300 border border-sky-500/20">Sync Ready</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                <Input
                  value={followerKey}
                  onChange={(e) => setFollowerKey(e.target.value)}
                  className="bg-[#0B172D] border-white/10 h-14 rounded-2xl text-white"
                  placeholder="new follower key"
                />
                <Button type="button" className="h-14 rounded-2xl bg-sky-500 text-black font-semibold w-full sm:w-auto" onClick={handleRegisterFollower}>
                  Register
                </Button>
              </div>
              <div className="rounded-[24px] bg-[#08131F] border border-white/10 p-4 text-white/70">
                <div className="space-y-3">
                  {followerAccounts.length === 0 ? (
                    <div className="rounded-3xl bg-white/5 p-4 text-sm text-white/60">
                      No followers registered yet. Add a follower key to sync a real account from your database.
                    </div>
                  ) : (
                    followerAccounts.slice(0, 4).map((account) => (
                      <div key={account.id} className="flex items-center justify-between gap-4 rounded-3xl bg-white/5 px-4 py-3">
                        <div>
                          <p className="text-sm text-white">{account.name}</p>
                          <p className="text-xs text-white/50">{account.accountId}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-emerald-300">
                          <span className="h-2 w-2 rounded-full bg-emerald-300" />
                          {account.risk || 'Active'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {showFollowerTerminal && (
            <Card className="bg-[#070D18] border border-white/10 rounded-[32px] shadow-2xl shadow-black/40 overflow-hidden">
              <CardHeader className="p-6 bg-[#081421] border-b border-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/40">Follower Terminal</p>
                    <CardTitle className="text-2xl font-semibold text-white">Live Follower Feed</CardTitle>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{followerAccounts.length} Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="rounded-[24px] bg-[#08131F] border border-white/10 p-4 text-sm text-white/70">
                  <p className="font-medium text-white">Follower balances and trade stats are synced live.</p>
                  <p className="mt-2 text-xs text-white/50">Tap any follower row to access their dashboard and review performance.</p>
                </div>
                <div className="grid gap-3">
                  {followerAccounts.length === 0 ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                      No follower accounts found. Your bridge will sync real accounts from the database when followers are registered.
                    </div>
                  ) : (
                    followerAccounts.map((account) => (
                      <div key={account.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white shadow-sm shadow-black/20">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{account.name}</p>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">{account.accountId}</p>
                          </div>
                          <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] uppercase tracking-[0.2em]">
                            {account.risk || 'Active'}
                          </Badge>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-3xl bg-[#0B172D] px-3 py-2 text-sm text-white/80">
                            <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">Balance</p>
                            <p className="mt-2 font-semibold text-white">{account.balance || 'N/A'}</p>
                          </div>
                          <div className="rounded-3xl bg-[#0B172D] px-3 py-2 text-sm text-white/80">
                            <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">Followers</p>
                            <p className="mt-2 font-semibold text-white">{account.followers ?? 'N/A'}</p>
                          </div>
                          <div className="rounded-3xl bg-[#0B172D] px-3 py-2 text-sm text-white/80">
                            <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">Performance</p>
                            <p className="mt-2 font-semibold text-emerald-300">{account.performance || '+0.00%'}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="rounded-[24px] bg-[#08131F] border border-white/10 p-4 text-sm text-white/70">
                  Syncing Cloud Terminal...
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-[#070D18] border border-white/10 rounded-[32px] shadow-2xl shadow-black/40 overflow-hidden">
            <CardHeader className="p-6 bg-[#081421] border-b border-white/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Open Trades</p>
                  <CardTitle className="text-2xl font-semibold text-white">Pending MT5 Signals</CardTitle>
                </div>
                <Button type="button" className="h-10 rounded-2xl bg-white/5 text-white border border-white/10">
                  Close All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="rounded-[24px] bg-[#08131F] border border-white/10 p-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">EUR/USD • BUY</p>
                    <p className="text-lg font-semibold text-white">Entry 1.08458</p>
                  </div>
                  <span className="text-emerald-300">+0.0051</span>
                </div>
                <p className="text-sm text-white/60">SL 1.08200 • TP 1.09100 • Lots 0.01 • 18 followers</p>
                <Button type="button" className="mt-4 h-10 rounded-2xl bg-white/5 text-white border border-white/10">
                  Close
                </Button>
              </div>
              <div className="rounded-[24px] bg-[#08131F] border border-white/10 p-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">GBP/USD • SELL</p>
                    <p className="text-lg font-semibold text-white">Entry 1.27205</p>
                  </div>
                  <span className="text-rose-300">-0.0003</span>
                </div>
                <p className="text-sm text-white/60">SL 1.27500 • TP 1.26500 • Lots 0.01 • 12 followers</p>
                <Button type="button" className="mt-4 h-10 rounded-2xl bg-white/5 text-white border border-white/10">
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#070D18] border border-white/10 rounded-[32px] shadow-2xl shadow-black/40 overflow-hidden">
            <CardHeader className="p-6 bg-[#081421] border-b border-white/10">
              <CardTitle className="text-2xl font-semibold text-white">Signal Ledger</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {logs.length === 0 ? (
                <div className="rounded-[24px] bg-[#08131F] border border-white/10 p-4 text-sm text-white/60">
                  No signals logged yet.
                </div>
              ) : (
                logs.slice(0, 3).map((entry, index) => (
                  <div key={index} className="rounded-[24px] bg-[#08131F] border border-white/10 p-4 text-sm text-white">
                    {entry}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
