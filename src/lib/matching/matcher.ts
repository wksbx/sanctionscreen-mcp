import { retrieveCandidates } from './candidates';
import { rerankCandidates } from './rerank';
import type { MatchResult, MatchingConfig, ScreenRequest, CompanyScreenRequest } from '@/lib/types';
import { DEFAULT_MATCHING_CONFIG } from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const RETRIEVE_LIMIT = parseInt(process.env.RETRIEVE_LIMIT || "20", 10);
const MAX_RESULTS = parseInt(process.env.MAX_RESULTS || "10", 10);

// ── screenPerson ──────────────────────────────────────────────────────────────

/**
 * Screen a person against the PEP / sanctions database.
 *
 * 1. Retrieves up to 20 Lucene candidates from Neo4j.
 * 2. Re-ranks them with fuzzy algorithms + optional DOB / nationality boosts.
 * 3. Returns at most 10 results, sorted descending by score.
 */
export async function screenPerson(
  request: ScreenRequest,
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG,
): Promise<MatchResult[]> {
  // Allow request.threshold to override config.minScore
  const effectiveConfig: MatchingConfig =
    request.threshold !== undefined
      ? { ...config, minScore: request.threshold }
      : config;

  const candidates = await retrieveCandidates(request.name, 'person', RETRIEVE_LIMIT);

  const results = await rerankCandidates(request.name, candidates, effectiveConfig, {
    dob: request.dob,
    nationality: request.nationality,
  });

  return results.slice(0, MAX_RESULTS);
}

// ── screenCompany ─────────────────────────────────────────────────────────────

/**
 * Screen a company against the sanctions database.
 *
 * 1. Retrieves up to 20 Lucene candidates from Neo4j.
 * 2. Re-ranks them with fuzzy algorithms.
 * 3. Returns at most 10 results, sorted descending by score.
 */
export async function screenCompany(
  request: CompanyScreenRequest,
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG,
): Promise<MatchResult[]> {
  // Allow request.threshold to override config.minScore
  const effectiveConfig: MatchingConfig =
    request.threshold !== undefined
      ? { ...config, minScore: request.threshold }
      : config;

  const candidates = await retrieveCandidates(request.name, 'company', RETRIEVE_LIMIT);

  const results = await rerankCandidates(request.name, candidates, effectiveConfig);

  return results.slice(0, MAX_RESULTS);
}
