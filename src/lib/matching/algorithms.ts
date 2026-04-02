/**
 * Pure fuzzy-matching algorithms with no external dependencies.
 * All functions are string-in / number-out (or string-tuple for doubleMetaphone).
 */

// ---------------------------------------------------------------------------
// Levenshtein Similarity
// ---------------------------------------------------------------------------

/**
 * Compute Levenshtein edit distance between two strings using the standard
 * dynamic-programming matrix, then normalise to a 0–1 similarity score.
 *
 * Identical strings → 1.0
 * Both empty        → 1.0
 * One empty         → 0.0
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 && b.length === 0) return 1.0;
  if (a.length === 0 || b.length === 0) return 0;

  const m = a.length;
  const n = b.length;

  // Two-row rolling approach for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  const distance = prev[n];
  return 1 - distance / Math.max(m, n);
}

// ---------------------------------------------------------------------------
// Jaro-Winkler Similarity
// ---------------------------------------------------------------------------

/**
 * Compute Jaro-Winkler similarity (0–1) between two strings.
 *
 * - Match window = floor(max(|a|, |b|) / 2) - 1
 * - Counts matches and transpositions per the standard Jaro formula
 * - Applies the Winkler prefix bonus (up to 4 chars, weight 0.1)
 */
export function jaroWinklerSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0;

  const matchWindow = Math.max(Math.floor(Math.max(a.length, b.length) / 2) - 1, 0);

  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);

  let matches = 0;

  // Find matches
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - matchWindow);
    const hi = Math.min(i + matchWindow, b.length - 1);
    for (let j = lo; j <= hi; j++) {
      if (!bMatched[j] && a[i] === b[j]) {
        aMatched[i] = true;
        bMatched[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const m = matches;
  const t = transpositions / 2;
  const jaro = (m / a.length + m / b.length + (m - t) / m) / 3;

  // Winkler prefix bonus
  let prefixLen = 0;
  const maxPrefix = Math.min(4, Math.min(a.length, b.length));
  while (prefixLen < maxPrefix && a[prefixLen] === b[prefixLen]) {
    prefixLen++;
  }

  return jaro + prefixLen * 0.1 * (1 - jaro);
}

// ---------------------------------------------------------------------------
// Double Metaphone
// ---------------------------------------------------------------------------

/**
 * Returns the Double Metaphone encoding [primary, secondary] for a word.
 * Each code is at most 4 characters.
 *
 * This is a practical implementation covering the most common English and
 * foreign-name rules used in PEP / sanctions screening:
 * consonant clusters, silent letters, CH, PH, SH, TH, vowels (only initial),
 * and per-letter mappings for B C D F G H J K L M N P Q R S T V W X Y Z.
 */
export function doubleMetaphone(word: string): [string, string] {
  if (!word) return ['', ''];

  const MAX = 4;

  // Uppercase for uniform processing
  const s = word.toUpperCase();
  let primary = '';
  let secondary = '';
  let i = 0;

  const len = s.length;

  /** Append to both codes (unless at max). */
  function add(p: string, sec?: string): void {
    const s2 = sec !== undefined ? sec : p;
    if (p && primary.length < MAX) primary += p.slice(0, MAX - primary.length);
    if (s2 && secondary.length < MAX) secondary += s2.slice(0, MAX - secondary.length);
  }

  /** Safe character accessor (returns '' for out-of-bounds). */
  function charAt(pos: number): string {
    return pos >= 0 && pos < len ? s[pos] : '';
  }

  /** Check if a string starting at pos matches sub. */
  function startsWith(pos: number, ...subs: string[]): boolean {
    return subs.some((sub) => s.slice(pos, pos + sub.length) === sub);
  }

  /** Is the character at pos a vowel? */
  function isVowel(pos: number): boolean {
    return 'AEIOU'.includes(charAt(pos));
  }

  // Handle initial silent letters and special two-character starts
  if (startsWith(0, 'GN', 'KN', 'PN', 'AE', 'WR')) {
    i = 1;
  }

  // Initial vowel → encode as 'A'
  if (isVowel(0)) {
    add('A');
    i = 1;
  }

  while (primary.length < MAX || secondary.length < MAX) {
    if (i >= len) break;

    const c = charAt(i);

    switch (c) {
      case 'A':
      case 'E':
      case 'I':
      case 'O':
      case 'U':
      case 'Y':
        // Vowels after initial position are not encoded individually
        i++;
        break;

      case 'B':
        add('P');
        i += charAt(i + 1) === 'B' ? 2 : 1;
        break;

      case 'C':
        // CH
        if (charAt(i + 1) === 'H') {
          if (startsWith(i - 2, 'SCH')) {
            add('SK');
          } else {
            add('X', 'X'); // CH → X (English) / X
          }
          i += 2;
          break;
        }
        // CI, CE, CY → S
        if (startsWith(i + 1, 'I', 'E', 'Y')) {
          add('S');
          i += 2;
          break;
        }
        // CK
        if (charAt(i + 1) === 'K') {
          add('K');
          i += 2;
          break;
        }
        // Double C
        if (charAt(i + 1) === 'C') {
          if (startsWith(i + 2, 'I', 'E', 'Y')) {
            add('KS');
            i += 3;
          } else {
            add('K');
            i += 2;
          }
          break;
        }
        add('K');
        i++;
        break;

      case 'D':
        if (charAt(i + 1) === 'G') {
          if (startsWith(i + 2, 'I', 'E', 'Y')) {
            add('J'); // DGE/DGI/DGY → J
            i += 3;
          } else {
            add('TK');
            i += 2;
          }
          break;
        }
        if (startsWith(i + 1, 'T', 'D')) {
          add('T');
          i += 2;
          break;
        }
        add('T');
        i++;
        break;

      case 'F':
        add('F');
        i += charAt(i + 1) === 'F' ? 2 : 1;
        break;

      case 'G': {
        // GH
        if (charAt(i + 1) === 'H') {
          if (!isVowel(i - 1)) {
            // GH after consonant – silent
            i += 2;
            break;
          }
          if (i === 0) {
            // initial GH
            if (isVowel(i + 2)) {
              add('K');
            } else {
              add('K');
            }
            i += 2;
            break;
          }
          i += 2;
          break;
        }
        // GN
        if (charAt(i + 1) === 'N') {
          if (i === 1 && isVowel(0)) {
            add('KN', 'N');
          } else {
            add('N');
          }
          i += 2;
          break;
        }
        // GE/GI/GY → K, J (Germanic/Latin)
        if (startsWith(i + 1, 'E', 'I', 'Y')) {
          add('K', 'J');
          i += 2;
          break;
        }
        // GG
        if (charAt(i + 1) === 'G') {
          if (startsWith(i + 2, 'I', 'E', 'Y')) {
            add('K', 'J');
            i += 3;
          } else {
            add('K');
            i += 2;
          }
          break;
        }
        add('K');
        i++;
        break;
      }

      case 'H':
        // H is voiced only if followed by a vowel and not after a vowel
        if (isVowel(i + 1) && !isVowel(i - 1)) {
          add('H');
        }
        i++;
        break;

      case 'J':
        add('J', 'H');
        i += charAt(i + 1) === 'J' ? 2 : 1;
        break;

      case 'K':
        if (charAt(i + 1) === 'K') {
          add('K');
          i += 2;
        } else if (charAt(i - 1) !== 'C') {
          add('K');
          i++;
        } else {
          i++;
        }
        break;

      case 'L':
        add('L');
        i += charAt(i + 1) === 'L' ? 2 : 1;
        break;

      case 'M':
        add('M');
        i += charAt(i + 1) === 'M' ? 2 : 1;
        break;

      case 'N':
        add('N');
        i += charAt(i + 1) === 'N' ? 2 : 1;
        break;

      case 'P':
        if (charAt(i + 1) === 'H') {
          add('F');
          i += 2;
        } else {
          add('P');
          i += charAt(i + 1) === 'P' ? 2 : 1;
        }
        break;

      case 'Q':
        add('K');
        i += charAt(i + 1) === 'Q' ? 2 : 1;
        break;

      case 'R':
        add('R');
        i += charAt(i + 1) === 'R' ? 2 : 1;
        break;

      case 'S':
        // SH
        if (charAt(i + 1) === 'H') {
          add('X');
          i += 2;
          break;
        }
        // SCH
        if (startsWith(i + 1, 'CH')) {
          add('SK');
          i += 3;
          break;
        }
        // SI/SIO/SIA
        if (startsWith(i + 1, 'IO') || startsWith(i + 1, 'IA')) {
          add('X', 'S');
          i += 3;
          break;
        }
        add('S');
        i += charAt(i + 1) === 'S' ? 2 : 1;
        break;

      case 'T':
        // TH
        if (charAt(i + 1) === 'H') {
          add('0', 'T'); // primary: θ (0), secondary: T
          i += 2;
          break;
        }
        // TIA/TIO → X
        if (startsWith(i + 1, 'IA') || startsWith(i + 1, 'IO')) {
          add('X');
          i += 3;
          break;
        }
        // TCH
        if (startsWith(i + 1, 'CH')) {
          add('X');
          i += 3;
          break;
        }
        add('T');
        i += startsWith(i + 1, 'T', 'D') ? 2 : 1;
        break;

      case 'V':
        add('F');
        i += charAt(i + 1) === 'V' ? 2 : 1;
        break;

      case 'W':
        // W only encodes if followed by a vowel
        if (isVowel(i + 1)) {
          add('A');
        }
        i++;
        break;

      case 'X':
        add('KS');
        i += charAt(i + 1) === 'X' ? 2 : 1;
        break;

      case 'Y':
        // Y only encodes if followed by a vowel
        if (isVowel(i + 1)) {
          add('A');
        }
        i++;
        break;

      case 'Z':
        add('S');
        i += charAt(i + 1) === 'Z' ? 2 : 1;
        break;

      default:
        i++;
        break;
    }
  }

  return [primary, secondary];
}

// ---------------------------------------------------------------------------
// Metaphone Similarity
// ---------------------------------------------------------------------------

/**
 * Returns 1.0 if any code from doubleMetaphone(a) matches any code from
 * doubleMetaphone(b), otherwise 0.
 *
 * Empty codes are excluded from comparison.
 */
export function metaphoneSimilarity(a: string, b: string): number {
  const codesA = doubleMetaphone(a).filter(Boolean);
  const codesB = doubleMetaphone(b).filter(Boolean);
  if (codesA.length === 0 || codesB.length === 0) return 0;

  for (const ca of codesA) {
    for (const cb of codesB) {
      if (ca === cb) return 1.0;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Token-Set Ratio (Dice Coefficient)
// ---------------------------------------------------------------------------

/**
 * Split both strings into lowercase token sets and compute the Dice coefficient:
 *   2 * |intersection| / (|A| + |B|)
 *
 * Same tokens in different order → 1.0
 * No shared tokens → 0
 */
export function tokenSetRatio(a: string, b: string): number {
  const tokenize = (s: string): Set<string> => {
    const tokens = s.toLowerCase().split(/\s+/).filter(Boolean);
    return new Set(tokens);
  };

  const setA = tokenize(a);
  const setB = tokenize(b);

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  return (2 * intersection) / (setA.size + setB.size);
}
