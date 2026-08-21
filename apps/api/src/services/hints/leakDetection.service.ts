/**
 * Layered leak-detection for AI-generated hints, run before a hint is ever
 * shown to a student:
 *   1. A cheap regex check for a full SELECT...FROM shaped fragment.
 *   2. n-gram overlap against the assignment's reference solution.
 *   3. Levenshtein similarity as a secondary check (catches near-verbatim
 *      short solutions that n-gram overlap alone might miss).
 * A third LLM-as-judge layer (from research/ai-hints.md) is intentionally
 * not implemented here - it needs a second model call plus an eval harness
 * to validate false-positive/negative rates, which is out of scope for this
 * pass. This is the extension point for it.
 */

const SQL_SHAPE_RE = /\bselect\b[\s\S]{0,200}?\bfrom\b/i;
const NGRAM_SIZE = 4;
const NGRAM_OVERLAP_THRESHOLD = 0.5;
const LEVENSHTEIN_SIMILARITY_THRESHOLD = 0.6;

const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prevRow = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prevRow[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let topLeft = prevRow[0]!;
    prevRow[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prevRow[j]!;
      prevRow[j] = a[i - 1] === b[j - 1] ? topLeft : 1 + Math.min(topLeft, prevRow[j]!, prevRow[j - 1]!);
      topLeft = temp;
    }
  }
  return prevRow[b.length]!;
};

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const ngrams = (text: string, size: number): Set<string> => {
  const tokens = tokenize(text);
  const grams = new Set<string>();
  for (let i = 0; i <= tokens.length - size; i++) {
    grams.add(tokens.slice(i, i + size).join(" "));
  }
  return grams;
};

const ngramOverlapRatio = (a: string, b: string, size: number): number => {
  const gramsA = ngrams(a, size);
  const gramsB = ngrams(b, size);
  if (gramsA.size === 0 || gramsB.size === 0) return 0;

  let overlap = 0;
  for (const gram of gramsA) {
    if (gramsB.has(gram)) overlap++;
  }
  return overlap / Math.min(gramsA.size, gramsB.size);
};

export interface LeakCheckResult {
  leaked: boolean;
  reason?: string;
}

export const LeakDetectionService = {
  check(hintText: string, solutionSql: string | null): LeakCheckResult {
    if (SQL_SHAPE_RE.test(hintText)) {
      return { leaked: true, reason: "hint contains a SELECT...FROM shaped fragment" };
    }

    if (!solutionSql) {
      return { leaked: false };
    }

    const overlap = ngramOverlapRatio(hintText, solutionSql, NGRAM_SIZE);
    if (overlap > NGRAM_OVERLAP_THRESHOLD) {
      return {
        leaked: true,
        reason: `hint overlaps ${Math.round(overlap * 100)}% with the reference solution (n-gram)`,
      };
    }

    const distance = levenshteinDistance(hintText.toLowerCase(), solutionSql.toLowerCase());
    const maxLen = Math.max(hintText.length, solutionSql.length);
    const similarity = maxLen > 0 ? 1 - distance / maxLen : 0;
    if (similarity > LEVENSHTEIN_SIMILARITY_THRESHOLD) {
      return {
        leaked: true,
        reason: `hint is ${Math.round(similarity * 100)}% similar to the reference solution (levenshtein)`,
      };
    }

    return { leaked: false };
  },
};
