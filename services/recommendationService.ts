/**
 * Lightweight recommendations (skills / geo / favorites) — no LLM required.
 */

import { getFavorites } from './favoriteService';
import { searchWorkersRanked, type RankedWorker } from './workerService';
import type { Country } from '../types/database';
import { logger } from '../utils/logger';

export type RecommendedWorker = RankedWorker & {
  reason: string;
  profilePath: string;
};

/**
 * Recommended workers for a customer hub: favorites first, then ranked by country/location.
 */
export async function getRecommendedWorkersForCustomer(
  userId: string,
  opts?: {
    country?: Country | null;
    location?: string | null;
    preferredSkills?: string[];
    limit?: number;
  }
): Promise<{ data: RecommendedWorker[]; error: string | null }> {
  const limit = opts?.limit ?? 6;
  const results: RecommendedWorker[] = [];
  const seen = new Set<string>();

  try {
    const favResult = await getFavorites(userId);
    if (favResult.data) {
      for (const fav of favResult.data) {
        const w = fav.worker;
        if (!w || seen.has(w.user_id)) continue;
        seen.add(w.user_id);
        results.push({
          ...(w as RankedWorker),
          compositeScore: (w as RankedWorker).compositeScore ?? w.rating ?? 0,
          reason: 'Saved favorite',
          profilePath: `/profile/${w.user_id}`,
        });
        if (results.length >= limit) {
          return { data: results, error: null };
        }
      }
    }

    const filters: { country?: Country; location?: string; skills?: string[] } = {};
    if (opts?.country) filters.country = opts.country;
    if (opts?.location) filters.location = opts.location;
    if (opts?.preferredSkills?.length) filters.skills = [opts.preferredSkills[0]];

    let ranked = await searchWorkersRanked(filters);
    if ((!ranked.data || ranked.data.length === 0) && filters.skills) {
      const { skills: _s, ...rest } = filters;
      ranked = await searchWorkersRanked(rest);
    }
    if ((!ranked.data || ranked.data.length === 0) && filters.location) {
      ranked = await searchWorkersRanked(
        opts?.country ? { country: opts.country } : {}
      );
    }

    if (ranked.data) {
      for (const w of ranked.data) {
        if (seen.has(w.user_id)) continue;
        seen.add(w.user_id);
        const skillHit =
          opts?.preferredSkills?.some((s) =>
            (w.skills || []).some(
              (ws) =>
                ws.toLowerCase().includes(s.toLowerCase()) ||
                s.toLowerCase().includes(ws.toLowerCase())
            ) ||
            (w.role || '').toLowerCase().includes(s.toLowerCase())
          ) ?? false;
        results.push({
          ...w,
          reason: skillHit
            ? 'Matches your interests'
            : opts?.country && w.country === opts.country
              ? 'Near you'
              : 'Top rated nearby',
          profilePath: `/profile/${w.user_id}`,
        });
        if (results.length >= limit) break;
      }
    }

    return { data: results, error: null };
  } catch (err) {
    logger.warn(
      'getRecommendedWorkersForCustomer failed',
      { error: err instanceof Error ? err.message : err },
      'recommendationService'
    );
    return {
      data: results,
      error: err instanceof Error ? err.message : 'Recommendations failed',
    };
  }
}
