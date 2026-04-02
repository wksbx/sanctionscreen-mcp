import { transliterate } from 'transliteration';

// Honorifics/titles to strip, matched as whole words (with optional trailing dot)
const HONORIFICS = [
  'mr',
  'mrs',
  'ms',
  'miss',
  'dr',
  'prof',
  'sir',
  'dame',
  'lord',
  'lady',
  'sheikh',
  'haj',
  'hajj',
  'mullah',
  'ayatollah',
  'general',
  'col',
  'maj',
  'capt',
  'lt',
  'sgt',
  'president',
  'minister',
  'senator',
  'governor',
  'hon',
  'rev',
  'fr',
  'sr',
  'jr',
];

// Build a single regex: match any honorific (with optional trailing dot) as a whole word,
// case-insensitively. The \b word boundary handles the surrounding context.
const HONORIFIC_RE = new RegExp(
  `\\b(${HONORIFICS.join('|')})\\.?\\b`,
  'gi',
);

/**
 * Normalizes a name for fuzzy matching by:
 * 1. Returning '' for empty input
 * 2. Transliterating non-Latin scripts to Latin
 * 3. Stripping diacritics
 * 4. Lowercasing
 * 5. Removing honorifics/titles
 * 6. Removing non-alpha characters except spaces and hyphens
 * 7. Collapsing multiple spaces and trimming
 */
export function normalizeName(name: string): string {
  if (!name) return '';

  // Step 2: Transliterate non-Latin scripts to Latin
  let result = transliterate(name);

  // Step 3: Strip diacritics via NFD decomposition + removal of combining marks
  result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Step 4: Lowercase
  result = result.toLowerCase();

  // Step 5: Remove honorifics (reset lastIndex since regex is global/stateful)
  HONORIFIC_RE.lastIndex = 0;
  result = result.replace(HONORIFIC_RE, '');

  // Step 6: Remove non-alpha characters except spaces and hyphens
  result = result.replace(/[^a-z \-]/g, '');

  // Step 7: Collapse multiple spaces and trim
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}
