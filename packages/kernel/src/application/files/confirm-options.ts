import type { ContentExpectation } from './content-expectation.js';

/** What a file uploaded straight to the storage is checked against before it is accepted. */
export interface ConfirmOptions extends ContentExpectation {
  readonly maxBytes?: number;
}
