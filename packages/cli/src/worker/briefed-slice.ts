import type { Slice } from '../progress/slice.js';

/** A row of the slices table as a worker is briefed on it: with the rules written for it under the tables. */
export interface BriefedSlice extends Slice {
  /** The invariants and the failures by name, from the line `- #<row>: ...` of the slices file; undefined when none. */
  readonly rules: string | undefined;
}
