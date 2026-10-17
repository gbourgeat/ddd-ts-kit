import type { Citation } from './citations-of.js';
import type { Evidence } from './evidence.js';
import { judgeCitation } from './judge-citation.js';
import type { Candidate, StaleCitation } from './stale-citation.js';

/** The names to report, and how many cited names the code has or are still to build. */
export interface JudgedCitations {
  readonly stale: readonly StaleCitation[];
  readonly counts: { readonly present: number; readonly planned: number };
}

/**
 * Judges each citation and keeps what to report: removed, refused or similar names, except one
 * whose sentence records its removal, and one whose successor the same part already cites.
 */
export function judgedCitations(citations: readonly Citation[], evidence: Evidence): JudgedCitations {
  const counts = { present: 0, planned: 0 };
  const stale: StaleCitation[] = [];

  for (const { name, document, rows, contexts, neighbours } of citations.filter(
    (citation) => !citation.name.recorded,
  )) {
    const judgement = judgeCitation(name, { document, line: name.line, contexts }, evidence);
    const { state } = judgement;

    if (state === 'present' || state === 'planned') {
      counts[state] += 1;
    } else if (!judgement.candidates.some((candidate) => cites(neighbours, candidate))) {
      stale.push({ rows, document, line: name.line, cited: name.cited, kind: name.kind, ...judgement, state });
    }
  }

  return { stale: stale.sort((a, b) => a.document.localeCompare(b.document) || a.line - b.line), counts };
}

function cites(neighbours: ReadonlySet<string>, { name, file }: Candidate): boolean {
  return neighbours.has(name) || [...neighbours].some((cited) => file === cited || file.endsWith(`/${cited}`));
}
