import type { ErrorMapper } from '../error/error-mapper.js';
import type { Representations } from '../representation/representations.js';
import type { Definitions } from './definitions.js';

/** What every operation of a document is written with: the mapper and the representations the server runs with. */
export interface Documenting {
  readonly mapper: ErrorMapper;
  readonly definitions: Definitions;
  readonly representations: Representations;
}
