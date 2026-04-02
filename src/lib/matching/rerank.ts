import {
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  metaphoneSimilarity,
  tokenSetRatio,
} from './algorithms';
import { normalizeName } from './normalize';
import type { RawCandidate } from './candidates';
import type { MatchResult, MatchingConfig } from '@/lib/types';

// ── Boost options ─────────────────────────────────────────────────────────────

export interface BoostOptions {
  dob?: string;
  nationality?: string;
}

// ── rerankCandidates ──────────────────────────────────────────────────────────

/**
 * Re-ranks raw candidates by computing a weighted composite of four fuzzy
 * string-similarity algorithms, then applying optional DOB / nationality boosts.
 *
 * Returns MatchResult[] sorted descending by score, filtered by config.minScore.
 */
export async function rerankCandidates(
  query: string,
  candidates: RawCandidate[],
  config: MatchingConfig,
  boost?: BoostOptions,
): Promise<MatchResult[]> {
  const normalizedQuery = normalizeName(query);

  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    const target = candidate.normalizedName || normalizeName(candidate.fullName);

    // ── Per-algorithm scores ──────────────────────────────────────────────────
    const lev = levenshteinSimilarity(normalizedQuery, target);
    const jw = jaroWinklerSimilarity(normalizedQuery, target);
    const meta = metaphoneSimilarity(normalizedQuery, target);
    const ts = tokenSetRatio(normalizedQuery, target);

    // ── Weighted composite ────────────────────────────────────────────────────
    const { levenshtein: wLev, jaroWinkler: wJw, metaphone: wMeta, tokenSet: wTs } = config.weights;
    let score = wLev * lev + wJw * jw + wMeta * meta + wTs * ts;

    // ── Boosts ────────────────────────────────────────────────────────────────
    if (boost?.dob && candidate.properties.dateOfBirth === boost.dob) {
      score += 0.05;
    }

    if (boost?.nationality) {
      const candidateNationality = candidate.properties.nationality;
      if (Array.isArray(candidateNationality) && candidateNationality.includes(boost.nationality)) {
        score += 0.03;
      }
    }

    // ── Cap at 1.0 ────────────────────────────────────────────────────────────
    score = Math.min(score, 1.0);

    // ── Filter below minScore ─────────────────────────────────────────────────
    if (score < config.minScore) continue;

    // ── Determine matchedField (algorithm with highest individual score) ──────
    const algScores: Record<string, number> = {
      levenshtein: lev,
      jaroWinkler: jw,
      metaphone: meta,
      tokenSet: ts,
    };
    const matchedField = Object.entries(algScores).reduce((best, [name, s]) =>
      s > algScores[best] ? name : best,
      'levenshtein',
    );

    // ── Build MatchResult ─────────────────────────────────────────────────────
    const props = candidate.properties;

    results.push({
      entityId: candidate.entityId,
      fullName: candidate.fullName,
      score,
      matchedField,
      entityType: candidate.entityType,
      pepRole: typeof props.pepRole === 'string' ? props.pepRole : undefined,
      sanctionsList: Array.isArray(props.sanctionsList)
        ? (props.sanctionsList as string[])
        : [],
      nationality: Array.isArray(props.nationality)
        ? (props.nationality as string[])
        : undefined,
      linkedEntityCount:
        typeof props.linkedEntityCount === 'number' ? props.linkedEntityCount : 0,
    });
  }

  // ── Sort descending by score ──────────────────────────────────────────────
  results.sort((a, b) => b.score - a.score);

  return results;
}
