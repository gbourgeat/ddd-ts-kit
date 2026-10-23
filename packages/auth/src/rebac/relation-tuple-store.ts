import type { RelationTuple } from './relation-tuple';

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

  /** Who is `relation` of `object`. */
  abstract readByObject(object: string, relation: string): Promise<readonly RelationTuple[]>;

  /** Everything `subject` is something of, whatever the relation: the reverse lookup of a listing. */
  abstract readBySubject(subject: string): Promise<readonly RelationTuple[]>;
}
