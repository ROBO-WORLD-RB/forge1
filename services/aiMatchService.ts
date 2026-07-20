/**
 * AI Matching Engine (MVP)
 * Parse natural-language job requests via ai-chat Edge Function,
 * then rank workers with existing searchWorkersRanked.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import {
  searchWorkersRanked,
  type RankedWorker,
  type UserLocation,
  type WorkerSearchFilters,
} from './workerService';
import { detectSpamText } from './aiSafety';
import { logger } from '../utils/logger';
import { analytics } from '../utils/analytics';
import type { Country } from '../types/database';

export type ParsedJobRequest = {
  service: string | null;
  urgency: 'low' | 'normal' | 'high' | 'emergency';
  location: string | null;
  country: Country | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: 'GHS' | 'NGN' | null;
  date: string | null;
  skills: string[];
  summary: string;
  emergency: boolean;
};

export type MatchedWorkerResult = RankedWorker & {
  matchReason: string;
  profilePath: string;
};

export interface AiMatchResult {
  parsed: ParsedJobRequest;
  workers: MatchedWorkerResult[];
  error: string | null;
  model?: string;
  heuristic?: boolean;
}

function skillVariants(service: string | null, skills: string[]): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  };
  if (service) {
    push(service);
    // Common singular/plural / role aliases
    if (/electrician/i.test(service)) push('Electrical');
    if (/plumb/i.test(service)) push('Plumbing');
    if (/carpent/i.test(service)) push('Carpentry');
    if (/paint/i.test(service)) push('Painting');
    if (/clean/i.test(service)) push('Cleaning');
    if (/hvac|ac\b|air.?cond/i.test(service)) {
      push('HVAC');
      push('AC Repair');
    }
  }
  for (const s of skills) push(s);
  return out.slice(0, 6);
}

function scoreSkillOverlap(worker: RankedWorker, needles: string[]): number {
  if (needles.length === 0) return 0;
  const hay = [
    worker.role || '',
    ...(worker.skills || []),
  ].map((s) => s.toLowerCase());
  let hits = 0;
  for (const n of needles) {
    const nl = n.toLowerCase();
    if (hay.some((h) => h === nl || h.includes(nl) || nl.includes(h))) hits += 1;
  }
  return hits;
}

function buildMatchReason(worker: RankedWorker, parsed: ParsedJobRequest, hits: number): string {
  const parts: string[] = [];
  if (hits > 0 && parsed.service) parts.push(`Matches ${parsed.service}`);
  else if (hits > 0) parts.push('Skills match');
  if (parsed.location && worker.location?.toLowerCase().includes(parsed.location.toLowerCase())) {
    parts.push('Nearby');
  }
  if (parsed.country && worker.country === parsed.country) parts.push('Same country');
  if (worker.verified) parts.push('Verified');
  if (worker.tier === 'premium' || worker.tier === 'basic') parts.push(`${worker.tier} tier`);
  if (worker.rating >= 4) parts.push(`${worker.rating.toFixed(1)}★`);
  return parts[0] || 'Top ranked match';
}

async function parseJobViaEdge(message: string): Promise<{
  parsed: ParsedJobRequest | null;
  model?: string;
  heuristic?: boolean;
  error: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return { parsed: null, error: 'Supabase not configured' };
  }

  const spam = detectSpamText(message);
  if (spam.flagged) {
    return { parsed: null, error: spam.reason || 'Message rejected' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        message,
        action: 'parse_job',
        mode: 'customer',
      },
    });

    if (error) {
      logger.warn('parse_job invoke failed', { error: error.message }, 'aiMatchService');
      return { parsed: null, error: error.message };
    }

    if (data?.error) {
      return { parsed: null, error: String(data.error) };
    }

    if (data?.parsed && typeof data.parsed === 'object') {
      return {
        parsed: data.parsed as ParsedJobRequest,
        model: typeof data.model === 'string' ? data.model : undefined,
        heuristic: Boolean(data.heuristic),
        error: null,
      };
    }

    return { parsed: null, error: 'Could not parse job request' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Parse failed';
    return { parsed: null, error: msg };
  }
}

/**
 * Local fallback parser when Edge is unavailable.
 */
export function heuristicParseJobRequest(message: string, defaultCountry?: Country | null): ParsedJobRequest {
  const lower = message.toLowerCase();
  const trades = [
    'electrician',
    'plumber',
    'carpenter',
    'painter',
    'cleaner',
    'hvac',
    'welder',
    'tiler',
    'mason',
    'mechanic',
  ];
  const service = trades.find((t) => lower.includes(t)) || null;
  let country: Country | null = defaultCountry || null;
  if (/\b(ghana|accra|kumasi|ghs)\b/i.test(message)) country = 'GH';
  if (/\b(nigeria|lagos|abuja|ngn)\b/i.test(message)) country = 'NG';
  const emergency =
    /\b(emergency|urgent|asap|flood|gas\s*leak|live\s*wire|no\s*power)\b/i.test(message);

  return {
    service,
    urgency: emergency ? 'emergency' : 'normal',
    location: null,
    country,
    budgetMin: null,
    budgetMax: null,
    currency: country === 'GH' ? 'GHS' : country === 'NG' ? 'NGN' : null,
    date: null,
    skills: service ? [service] : [],
    summary: message.slice(0, 200),
    emergency,
  };
}

async function fetchRankedWithFallback(
  parsed: ParsedJobRequest,
  userLocation?: UserLocation
): Promise<RankedWorker[]> {
  const variants = skillVariants(parsed.service, parsed.skills);
  const attempts: WorkerSearchFilters[] = [];

  // Softest skill match first: one skill at a time via contains, then geo-only
  if (variants[0] && parsed.country) {
    attempts.push({ country: parsed.country, location: parsed.location || undefined, skills: [variants[0]] });
  }
  if (parsed.country) {
    attempts.push({ country: parsed.country, location: parsed.location || undefined });
  }
  if (parsed.location) {
    attempts.push({ location: parsed.location });
  }
  attempts.push({});

  let best: RankedWorker[] = [];

  for (const filters of attempts) {
    const result = await searchWorkersRanked(filters, userLocation);
    if (result.error || !result.data) continue;
    if (result.data.length === 0) continue;

    // Re-rank by skill overlap when we have needles
    if (variants.length > 0) {
      const scored = [...result.data].sort((a, b) => {
        const ha = scoreSkillOverlap(a, variants);
        const hb = scoreSkillOverlap(b, variants);
        if (hb !== ha) return hb - ha;
        return b.compositeScore - a.compositeScore;
      });
      // Prefer lists that actually hit skills
      const withHits = scored.filter((w) => scoreSkillOverlap(w, variants) > 0);
      best = withHits.length > 0 ? withHits : scored;
    } else {
      best = result.data;
    }

    if (best.length > 0) break;
  }

  return best;
}

/**
 * Parse NL job request and return ranked worker shortlist with profile links.
 */
export async function matchWorkersWithAI(
  message: string,
  opts?: {
    defaultCountry?: Country | null;
    userLocation?: UserLocation;
    limit?: number;
  }
): Promise<AiMatchResult> {
  const limit = opts?.limit ?? 8;
  const spam = detectSpamText(message);
  if (spam.flagged) {
    return {
      parsed: heuristicParseJobRequest(message, opts?.defaultCountry),
      workers: [],
      error: spam.reason || 'Message rejected',
    };
  }

  let parsed: ParsedJobRequest | null = null;
  let model: string | undefined;
  let heuristic = false;

  const edge = await parseJobViaEdge(message);
  if (edge.parsed) {
    parsed = edge.parsed;
    model = edge.model;
    heuristic = Boolean(edge.heuristic);
  } else {
    parsed = heuristicParseJobRequest(message, opts?.defaultCountry);
    heuristic = true;
  }

  if (!parsed.country && opts?.defaultCountry) {
    parsed = { ...parsed, country: opts.defaultCountry };
  }

  try {
    const ranked = await fetchRankedWithFallback(parsed, opts?.userLocation);
    const variants = skillVariants(parsed.service, parsed.skills);

    const workers: MatchedWorkerResult[] = ranked.slice(0, limit).map((w) => {
      const hits = scoreSkillOverlap(w, variants);
      return {
        ...w,
        matchReason: buildMatchReason(w, parsed!, hits),
        profilePath: `/profile/${w.user_id}`,
      };
    });

    analytics.track('ai_match', {
      service: parsed.service || 'unknown',
      country: parsed.country || 'any',
      count: workers.length,
      emergency: parsed.emergency,
      heuristic,
    });

    return {
      parsed,
      workers,
      error: null,
      model,
      heuristic,
    };
  } catch (err) {
    logger.error(
      'AI match ranking failed',
      { error: err instanceof Error ? err.message : err },
      'aiMatchService'
    );
    return {
      parsed,
      workers: [],
      error: err instanceof Error ? err.message : 'Matching failed',
      model,
      heuristic,
    };
  }
}

/**
 * Draft a worker application / quote message (text only — not payment).
 */
export async function draftQuoteWithAI(job: {
  title: string;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  country?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string | null;
}): Promise<{ text: string; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { text: '', error: 'Supabase not configured' };
  }

  const prompt = `Draft my application quote for this job: ${job.title}`;

  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        message: prompt,
        action: 'draft_quote',
        mode: 'worker',
        context: {
          title: job.title,
          description: job.description || '',
          category: job.category || '',
          location: job.location || '',
          country: job.country || '',
          budgetMin: job.budgetMin ?? null,
          budgetMax: job.budgetMax ?? null,
          currency: job.currency || null,
        },
      },
    });

    if (error) return { text: '', error: error.message };
    if (data?.error) return { text: '', error: String(data.error) };
    if (typeof data?.text === 'string' && data.text.trim()) {
      const spam = detectSpamText(data.text);
      if (spam.flagged) {
        return { text: '', error: 'Draft looked unusable — try again or write your own.' };
      }
      analytics.track('ai_draft_quote', { category: job.category || 'unknown' });
      return { text: data.text.trim(), error: null };
    }
    return { text: '', error: 'No draft returned' };
  } catch (err) {
    return { text: '', error: err instanceof Error ? err.message : 'Draft failed' };
  }
}
