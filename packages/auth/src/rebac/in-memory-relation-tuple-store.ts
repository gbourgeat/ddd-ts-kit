import type { RelationTuple } from './relation-tuple';
import type { RelationTupleStore } from './relation-tuple-store';
import { tupleKey } from './tuple-key';

export class InMemoryRelationTupleStore implements RelationTupleStore {
  private readonly tuples = new Map<string, RelationTuple>();

  async write(tuples: readonly RelationTuple[]): Promise<void> {
    for (const tuple of tuples) {
      this.tuples.set(tupleKey(tuple), { ...tuple });
    }
  }

  async delete(tuples: readonly RelationTuple[]): Promise<void> {
    for (const tuple of tuples) {
      this.tuples.delete(tupleKey(tuple));
    }
  }

  async readByObject(object: string, relation: string): Promise<readonly RelationTuple[]> {
    return this.all().filter((tuple) => tuple.object === object && tuple.relation === relation);
  }

  async readBySubject(subject: string): Promise<readonly RelationTuple[]> {
    return this.all().filter((tuple) => tuple.subject === subject);
  }

  /** Every stored tuple, for the assertions of a test. */
  all(): readonly RelationTuple[] {
    return [...this.tuples.values()];
  }
}
