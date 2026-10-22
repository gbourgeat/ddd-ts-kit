import { citationLine } from '../citations/citation-line';
import type { CitationsAtRef } from '../citations/stale-names-at';

/** Past this many lines, the briefing points to the JSON: it stays under 300 words. */
const MOST = 8;

/** The names of the design the trunk does not have, as a worker reads them in its briefing; nothing when there is none. */
export function staleNamesBlock({ base, commit, citations }: CitationsAtRef): string[] {
  if (citations.length === 0) {
    return [];
  }

  const more = citations.length - MOST;

  return [
    `Names of the design that ${base} does not have (checked at ${commit}): build on what ${base} has,`,
    'and put each line in your report as a note for the conductor, who corrects the document.',
    ...citations.slice(0, MOST).map((citation) => `- ${citationLine(citation, base)}`),
    ...(more > 0 ? [`(${more} more: worker-scope --json)`] : []),
  ];
}
