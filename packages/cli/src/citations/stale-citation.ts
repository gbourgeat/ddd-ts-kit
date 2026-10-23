import type { CitedKind } from './cited-name';

/**
 * What a cited name is to the code: `removed` (the history had it), `refused` (a place the
 * canonical tree refuses), `similar` (never there, but the code has a close name that arrived
 * after the line was written), `present`, or `planned` (everything else, never reported).
 */
type CitationState = 'removed' | 'refused' | 'similar' | 'present' | 'planned';

/** A name the code has that may be what the design means, and why it is offered. */
export interface Candidate {
  readonly name: string;
  readonly file: string;
  readonly evidence: 'renamed' | 'added-with-removal' | 'same-stem';
}

/** The removal of a file that gave a cited name; without a commit for a change not committed yet. */
export interface RemovedBy {
  readonly commit?: string;
  readonly date?: string;
  readonly subject?: string;
  readonly path: string;
}

/** What one cited name is, with its evidence. */
export interface Judgement {
  readonly state: CitationState;
  readonly removedBy?: RemovedBy;
  /** Why the canonical tree refuses a `refused` path. */
  readonly refusal?: string;
  readonly candidates: readonly Candidate[];
}

/** A name the design of a row cites that the code does not have: what is reported. */
export interface StaleCitation extends Judgement {
  readonly rows: readonly string[];
  readonly document: string;
  readonly line: number;
  readonly cited: string;
  readonly kind: CitedKind;
  readonly state: 'removed' | 'refused' | 'similar';
}
