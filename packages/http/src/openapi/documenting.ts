import type { ErrorMapper } from '../error/error-mapper';
import type { Representations } from '../representation/representations';
import type { Definitions } from './definitions';

/** What every operation of a document is written with: the mapper and the representations the server runs with. */
export interface Documenting {
  readonly mapper: ErrorMapper;
  readonly definitions: Definitions;
  /** `undefined` when the server negotiates nothing: every answer is JSON, and no request is refused 406 or 415 for its media type. */
  readonly representations: Representations | undefined;
}
