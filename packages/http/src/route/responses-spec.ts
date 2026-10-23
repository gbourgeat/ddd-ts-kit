import type { ResponseSpec } from './response-spec';

export interface ResponsesSpec {
  readonly [status: number]: ResponseSpec;
}
