import type { RelationTuple } from './relation-tuple.js';

/**
 * Where relation tuples live. A SQL adapter writes in the transaction of the current unit of
 * work, so a tuple and the aggregate it describes are committed together.
 */
export abstract class RelationTupleStore {
  static readonly tokenKey = 'auth.RelationTupleStore';

  /** Writing a tuple that exists changes nothing. */
  abstract write(tuples: readonly RelationTuple[]): Promise<void>;

  /** Deleting a tuple that does not exist changes nothing. */
  abstract delete(tuples: readonly RelationTuple[]): Promise<void>;

  abstract readByObject(object: string, relation: string): Promise<readonly RelationTuple[]>;

  /** Exact match on the subject, a userset included: the reverse lookup. */
  abstract readBySubject(subject: string): Promise<readonly RelationTuple[]>;
}
