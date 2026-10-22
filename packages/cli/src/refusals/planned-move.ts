import type { LegacyError } from './legacy-error';
import type { Move } from './move';

/** A class per error with the decision taken about it. */
export interface PlannedMove {
  readonly error: LegacyError;
  readonly move: Move;
}
