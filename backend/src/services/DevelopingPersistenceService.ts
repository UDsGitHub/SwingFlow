import { supabaseAdmin } from '../db/supabase';
import { DevelopingSetup, StrategyType } from '../types';

const DEFAULT_SESSION_CAP = 6;
const DEFAULT_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

function sessionCap(): number {
  const v = process.env.DEVELOPING_SESSION_CAP;
  if (v != null && v !== '' && !Number.isNaN(Number(v))) return Math.max(1, Number(v));
  return DEFAULT_SESSION_CAP;
}

function maxAgeMs(): number {
  const v = process.env.DEVELOPING_MAX_AGE_MS;
  if (v != null && v !== '' && !Number.isNaN(Number(v))) return Math.max(1, Number(v));
  return DEFAULT_MAX_AGE_MS;
}

function candidateKey(symbol: string, strategy: string): string {
  return `${symbol}|${strategy}`;
}

export interface DevelopingCandidateRow {
  id: string;
  user_id: string;
  symbol: string;
  strategy: string;
  direction: string;
  confidence: number;
  explanation: string;
  entry_zone_low: number | null;
  entry_zone_high: number | null;
  status: string;
  sessions_seen: number;
  first_seen_at: number;
  last_seen_at: number;
  converted_at: number | null;
  last_scan_id: string | null;
}

export function mapDevelopingRowToSetup(row: DevelopingCandidateRow): DevelopingSetup {
  const low = row.entry_zone_low != null ? Number(row.entry_zone_low) : null;
  const high = row.entry_zone_high != null ? Number(row.entry_zone_high) : null;
  const estimatedEntryZone =
    low != null && high != null && !Number.isNaN(low) && !Number.isNaN(high)
      ? ([low, high] as [number, number])
      : null;

  return {
    id: row.id,
    symbol: row.symbol,
    strategy: row.strategy as StrategyType,
    direction: row.direction as DevelopingSetup['direction'],
    confidence: Number(row.confidence),
    explanation: row.explanation,
    estimatedEntryZone,
    detectedAt: Number(row.last_seen_at),
    sessionsSeen: row.sessions_seen,
    status: row.status as DevelopingSetup['status'],
  };
}

export async function markDevelopingConverted(
  userId: string,
  symbol: string,
  strategy: string,
): Promise<void> {
  const now = Date.now();
  const { error } = await supabaseAdmin
    .from('developing_candidates')
    .update({ status: 'CONVERTED', converted_at: now })
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .eq('strategy', strategy)
    .eq('status', 'ACTIVE');

  if (error) {
    console.warn('[DevelopingPersistence] markConverted:', error.message);
  }
}

export async function persistDevelopingAfterScan(
  userId: string,
  scanId: string,
  candidates: DevelopingSetup[],
): Promise<void> {
  const cap = sessionCap();
  const ageMs = maxAgeMs();
  const now = Date.now();

  const { data: activeSetups } = await supabaseAdmin
    .from('trade_setups')
    .select('symbol,strategy')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  const blockedKeys = new Set(
    (activeSetups ?? []).map((s: { symbol: string; strategy: string }) =>
      candidateKey(s.symbol, s.strategy),
    ),
  );

  const { data: conflictingDev } = await supabaseAdmin
    .from('developing_candidates')
    .select('id,symbol,strategy')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  for (const r of conflictingDev ?? []) {
    if (blockedKeys.has(candidateKey(r.symbol, r.strategy))) {
      const { error: exErr } = await supabaseAdmin
        .from('developing_candidates')
        .update({ status: 'EXPIRED' })
        .eq('id', r.id);
      if (exErr) console.warn('[DevelopingPersistence] expire conflict:', exErr.message);
    }
  }

  const filteredCandidates = candidates.filter(
    (c) => !blockedKeys.has(candidateKey(c.symbol, c.strategy)),
  );

  const keysThisScan = new Set(filteredCandidates.map((c) => candidateKey(c.symbol, c.strategy)));

  for (const c of filteredCandidates) {
    const low = c.estimatedEntryZone?.[0] ?? null;
    const high = c.estimatedEntryZone?.[1] ?? null;

    const { data: existing, error: selErr } = await supabaseAdmin
      .from('developing_candidates')
      .select('id,sessions_seen,first_seen_at,status')
      .eq('user_id', userId)
      .eq('symbol', c.symbol)
      .eq('strategy', c.strategy)
      .maybeSingle();

    if (selErr) {
      console.warn('[DevelopingPersistence] select:', selErr.message);
      continue;
    }

    if (existing?.status === 'CONVERTED') continue;

    const nextSessions = existing ? Number(existing.sessions_seen) + 1 : 1;
    const firstSeen = existing ? Number(existing.first_seen_at) : now;
    const tooManySessions = nextSessions > cap;
    const tooOld = now - firstSeen > ageMs;
    const nextStatus = tooManySessions || tooOld ? 'EXPIRED' : 'ACTIVE';

    const payload = {
      user_id: userId,
      symbol: c.symbol,
      strategy: c.strategy,
      direction: c.direction,
      confidence: c.confidence,
      explanation: c.explanation,
      entry_zone_low: low,
      entry_zone_high: high,
      status: nextStatus,
      sessions_seen: nextSessions,
      first_seen_at: firstSeen,
      last_seen_at: now,
      last_scan_id: scanId,
    };

    if (existing?.id) {
      const { error: upErr } = await supabaseAdmin
        .from('developing_candidates')
        .update(payload)
        .eq('id', existing.id);
      if (upErr) console.warn('[DevelopingPersistence] update:', upErr.message);
    } else {
      const { error: insErr } = await supabaseAdmin.from('developing_candidates').insert(payload);
      if (insErr) console.warn('[DevelopingPersistence] insert:', insErr.message);
    }
  }

  const { data: activeRows, error: listErr } = await supabaseAdmin
    .from('developing_candidates')
    .select('id,symbol,strategy')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  if (listErr) {
    console.warn('[DevelopingPersistence] list active:', listErr.message);
    return;
  }

  for (const r of activeRows ?? []) {
    const key = candidateKey(r.symbol, r.strategy);
    if (!keysThisScan.has(key)) {
      const { error: exErr } = await supabaseAdmin
        .from('developing_candidates')
        .update({ status: 'EXPIRED' })
        .eq('id', r.id);
      if (exErr) console.warn('[DevelopingPersistence] expire missing:', exErr.message);
    }
  }

  const { data: stillActive, error: staleErr } = await supabaseAdmin
    .from('developing_candidates')
    .select('id,sessions_seen,first_seen_at')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  if (staleErr) return;

  for (const r of stillActive ?? []) {
    const sessions = Number(r.sessions_seen);
    const first = Number(r.first_seen_at);
    if (sessions > cap || now - first > ageMs) {
      await supabaseAdmin
        .from('developing_candidates')
        .update({ status: 'EXPIRED' })
        .eq('id', r.id);
    }
  }
}

export async function fetchActiveDevelopingForUser(
  userId: string,
  limit = 20,
): Promise<DevelopingSetup[]> {
  const { data, error } = await supabaseAdmin
    .from('developing_candidates')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .order('confidence', { ascending: false })
    .order('last_seen_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[DevelopingPersistence] fetchActive:', error.message);
    return [];
  }

  const { data: activeTrades } = await supabaseAdmin
    .from('trade_setups')
    .select('symbol,strategy')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  const blocked = new Set(
    (activeTrades ?? []).map((s: { symbol: string; strategy: string }) =>
      candidateKey(s.symbol, s.strategy),
    ),
  );

  return (data as DevelopingCandidateRow[])
    .filter((row) => !blocked.has(candidateKey(row.symbol, row.strategy)))
    .map(mapDevelopingRowToSetup);
}

export async function fetchDevelopingStats(userId: string): Promise<{
  converted: number;
  active: number;
  everTracked: number;
}> {
  const [convRes, actRes, allRes] = await Promise.all([
    supabaseAdmin
      .from('developing_candidates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'CONVERTED'),
    supabaseAdmin
      .from('developing_candidates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'ACTIVE'),
    supabaseAdmin
      .from('developing_candidates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  return {
    converted: convRes.count ?? 0,
    active: actRes.count ?? 0,
    everTracked: allRes.count ?? 0,
  };
}
