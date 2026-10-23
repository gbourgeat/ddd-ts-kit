import type { Way } from './via.js';

/**
 * The ways of holding a derived relation: one of `anyOf` (OpenFGA: `or`), every one of `allOf`
 * (`and`), none of `butNot` (`but not`). At least one of `anyOf` and `allOf` names a way.
 */
export interface Ways {
  readonly anyOf?: readonly Way[];
  readonly allOf?: readonly Way[];
  readonly butNot?: readonly Way[];
}
