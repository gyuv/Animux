/**
 * Matching an AniList title to a scraper catalogue's title.
 *
 * Shared by every adapter that has to bridge those two namings, because they
 * routinely spell a show differently — AniList's romaji against a localised
 * name — and an equality test rejects most real titles, leaving the viewer
 * with "no source" for a series that is plainly there.
 */

/**
 * Ordinals as these catalogues actually write them. A season number is the one
 * part of a title that must survive normalising intact, so every spelling of
 * it collapses to the same digit — "2nd", "second" and "II" are the same
 * season, and none of them is season one.
 */
const ORDINALS: Record<string, string> = {
  '1st': '1', first: '1', i: '1',
  '2nd': '2', second: '2', ii: '2',
  '3rd': '3', third: '3', iii: '3',
  '4th': '4', fourth: '4', iv: '4',
  '5th': '5', fifth: '5', v: '5',
  '6th': '6', sixth: '6', vi: '6',
};

/** Loose comparison: punctuation and case carry no meaning across these sites. */
export function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    // "Season", "Part" and "Cour" are noise; the number beside them is not.
    .filter((token) => !['season', 'part', 'cour'].includes(token))
    .map((token) => ORDINALS[token] ?? token)
    .join(' ')
    .trim();
}

/**
 * Resolve a HiAnime id from the titles AniList knows a show by. Every title
 * variant is tried, and only an exact normalised match counts — HiAnime's
 * search happily returns a spin-off for a season-two query.
 */
export function tokens(value: string): string[] {
  return normalise(value).split(' ').filter(Boolean);
}

/**
 * How confident we are that two titles name the same show, 0–1.
 *
 * Exact equality after normalising is the easy case. The hard one is that
 * these two catalogues frequently spell a show differently — AniList's romaji
 * against HiAnime's localised name — so a pure equality test rejects most real
 * titles and the viewer gets "no source" for a show that is plainly there.
 * Trying every name AniList knows and scoring the overlap covers that.
 *
 * The ordinal guard is the important part: a season or part number present on
 * one side and absent or different on the other is a *different season*, not a
 * near miss, and confidently serving season one to someone who asked for
 * season three is worse than serving nothing.
 */
export function similarity(a: string, b: string): number {
  const left = normalise(a);
  const right = normalise(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const ta = tokens(a);
  const tb = tokens(b);

  const ordinals = (list: string[]) => list.filter((t) => /^\d+$/.test(t)).join(',');
  if (ordinals(ta) !== ordinals(tb)) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  const dice = (2 * shared) / (setA.size + setB.size);

  // "Frieren" against "Frieren Beyond Journey's End" is the same show under a
  // shorter name, which token overlap alone scores too harshly.
  const contained = left.includes(right) || right.includes(left);
  return contained ? Math.max(dice, 0.85) : dice;
}

/** Below this, treat it as no match rather than guess. */
export const CONFIDENCE = 0.72;

/** How many of AniList's names to spend a search request on. */
export const MAX_QUERIES = 3;

export interface Candidate {
  id: string;
  names: (string | null | undefined)[];
}

/**
 * Why a match failed, in the three shapes that need different fixes:
 * the search never answered, it answered with nothing, or it answered with
 * candidates that were all too different. Collapsing those into one message
 * makes a network problem look identical to a naming problem.
 */
export interface MatchReport {
  id: string | null;
  searched: number;
  candidates: number;
  bestScore: number;
  bestName: string | null;
}

export function matchWithReport(titles: string[], candidates: Candidate[]): MatchReport {
  let best: { id: string; score: number; name: string | null } | null = null;

  for (const candidate of candidates) {
    if (!candidate.id) continue;
    for (const name of candidate.names) {
      if (!name) continue;
      for (const title of titles) {
        const score = similarity(title, name);
        if (!best || score > best.score) best = { id: candidate.id, score, name };
      }
    }
  }

  return {
    id: best && best.score >= CONFIDENCE ? best.id : null,
    searched: titles.length,
    candidates: candidates.length,
    bestScore: best ? Number(best.score.toFixed(2)) : 0,
    bestName: best?.name ?? null,
  };
}

/** One line saying which of the three failures this was. */
export function describeMatchFailure(report: MatchReport, source: string): string {
  if (report.candidates === 0) {
    return `${source}: search returned no candidates for ${report.searched} title(s) — ` +
      'the host is unreachable, blocking us, or has changed its markup.';
  }
  return `${source}: ${report.candidates} candidate(s), best "${report.bestName}" scored ` +
    `${report.bestScore} against ${report.searched} title(s), below the ${CONFIDENCE} bar.`;
}

/**
 * Pick the best-scoring candidate across every name AniList knows, or null if
 * nothing clears the bar. A page saying "no source" is recoverable; silently
 * playing a different series is not.
 */
export function bestMatch(titles: string[], candidates: Candidate[]): string | null {
  return matchWithReport(titles, candidates).id;
}
