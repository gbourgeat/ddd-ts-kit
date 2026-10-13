import type { ContentExpectation } from './content-expectation.js';

export interface InspectionLimits {
  /** Beyond it the stream fails with `FILE_TOO_LARGE`. */
  readonly maxBytes?: number;
  /** When given, the first bytes are checked against it before any byte goes on. */
  readonly expected?: ContentExpectation;
}
