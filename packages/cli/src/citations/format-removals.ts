import { citationLine } from './citation-line.js';
import type { StaleCitation } from './stale-citation.js';

/** `cited --removed-since` for a reader: the names a change removes that the design of rows not done still cites. */
export function formatRemovals(citations: readonly StaleCitation[], since: string): string {
  if (citations.length === 0) {
    return `No name removed since ${since} is cited by the design of a row not done.`;
  }

  return [
    `Names removed since ${since} that the design of rows not done still cites (the documents to correct):`,
    ...citations.map((citation) => {
      const rows = citation.rows.map((id) => `#${id}`).join(', ');

      return `- ${citationLine(citation, since)}${rows === '' ? '' : ` (${rows})`}`;
    }),
  ].join('\n');
}
