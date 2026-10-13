import type { FormBlock } from './form-block.js';
import type { HttpMethod } from '../route/http-method.js';

/**
 * A form described by the server, as a neutral tree of blocks for a front end with its own
 * rendering engine: what a route declares, for the caller who asked. JSON Forms is produced
 * from the same tree.
 */
export interface FormDescription {
  readonly type: 'form';
  readonly operation: string;
  readonly method: HttpMethod;
  readonly path: string;
  /** A translation key: the operation id. */
  readonly label: string;
  readonly blocks: readonly FormBlock[];
}
