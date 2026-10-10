import type { ResponseSpec } from './response-spec.js';

export interface ResponsesSpec {
  readonly [status: number]: ResponseSpec;
}
