import type { Schema } from './schema.js';
import { tupleKey, type RelationTuple } from './tuples.js';

/**
 * Where relation tuples live. A SQL adapter writes in the transaction of the current unit of
 * work, so a tuple and the aggregate it describes are committed together.
 */
export interface RelationTupleStore {
  /** Writing a tuple that exists changes nothing. */
  write(tuples: readonly RelationTuple[]): Promise<void>;
  /** Deleting a tuple that does not exist changes nothing. */
  delete(tuples: readonly RelationTuple[]): Promise<void>;
  readByObject(object: string, relation: string): Promise<readonly RelationTuple[]>;
  /** Exact match on the subject, a userset included: the reverse lookup. */
  readBySubject(subject: string): Promise<readonly RelationTuple[]>;
}

export class InMemoryRelationTupleStore implements RelationTupleStore {
  readonly #tuples = new Map<string, RelationTuple>();

  async write(tuples: readonly RelationTuple[]): Promise<void> {
    for (const tuple of tuples) this.#tuples.set(tupleKey(tuple), { ...tuple });
  }

  async delete(tuples: readonly RelationTuple[]): Promise<void> {
    for (const tuple of tuples) this.#tuples.delete(tupleKey(tuple));
  }

  async readByObject(object: string, relation: string): Promise<readonly RelationTuple[]> {
    return this.all().filter((tuple) => tuple.object === object && tuple.relation === relation);
  }

  async readBySubject(subject: string): Promise<readonly RelationTuple[]> {
    return this.all().filter((tuple) => tuple.subject === subject);
  }

  /** Every stored tuple, for the assertions of a test. */
  all(): readonly RelationTuple[] {
    return [...this.#tuples.values()];
  }
}

/** Refuses, on write, a tuple the schema does not describe. Reads and deletions pass through. */
export class SchemaCheckedTupleStore implements RelationTupleStore {
  constructor(
    private readonly schema: Schema,
    private readonly store: RelationTupleStore,
  ) {}

  async write(tuples: readonly RelationTuple[]): Promise<void> {
    for (const tuple of tuples) this.schema.assertWritable(tuple);
    await this.store.write(tuples);
  }

  delete(tuples: readonly RelationTuple[]): Promise<void> {
    return this.store.delete(tuples);
  }

  readByObject(object: string, relation: string): Promise<readonly RelationTuple[]> {
    return this.store.readByObject(object, relation);
  }

  readBySubject(subject: string): Promise<readonly RelationTuple[]> {
    return this.store.readBySubject(subject);
  }
}
