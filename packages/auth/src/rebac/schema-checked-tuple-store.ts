import type { RelationTuple } from './relation-tuple.js';
import type { RelationTupleStore } from './relation-tuple-store.js';
import type { Schema } from './schema.js';

/** Refuses, on write, a tuple the schema does not describe. Reads and deletions pass through. */
export class SchemaCheckedTupleStore implements RelationTupleStore {
  constructor(
    private readonly schema: Schema,
    private readonly store: RelationTupleStore,
  ) {}

  async write(tuples: readonly RelationTuple[]): Promise<void> {
    for (const tuple of tuples) {
      this.schema.assertWritable(tuple);
    }

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
