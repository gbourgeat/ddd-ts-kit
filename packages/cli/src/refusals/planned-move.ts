import type { LegacyError } from './legacy-error.js';
import type { Move } from './move.js';

/** A class per error with the decision taken about it. */
export interface PlannedMove {
  readonly error: LegacyError;
  readonly move: Move;
}
