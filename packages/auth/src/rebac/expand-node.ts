import type { RelationTuple } from './relation-tuple.js';

/** One step of an evaluation: what was asked of which object, how, and with what answer. */
export interface ExpandNode {
  readonly object: string;
  /** The relation or permission evaluated on the object. */
  readonly relation: string;
  readonly via:
    | 'relation'
    | 'direct'
    | 'userset'
    | 'computed'
    | 'union'
    | 'intersection'
    | 'exclusion'
    | 'from'
    | 'cycle'
    | 'depth-limit'
    | 'unknown';
  readonly allowed: boolean;
  /** The stored fact that led to this step. */
  readonly tuple?: RelationTuple;
  readonly children: readonly ExpandNode[];
}
