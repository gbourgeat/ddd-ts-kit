import type { RelationTuple, RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import type { KnexContext } from '@ddd-ts-kit/knex';
import type { Knex } from 'knex';
import { RELATION_TUPLES_TABLE } from '@/platform/auth/relationships/relation-tuples-table';

interface Placed {
  /** The database schema the table was created in. */
  readonly schema: string;
}

const COLUMNS = ['object', 'relation', 'subject'] as const;

/**
 * The relation tuples in PostgreSQL. Every query runs on the executor of the context: inside a
 * unit of work a tuple is written in the transaction of the change it describes, committed or
 * rolled back with it, and a check made by that same work reads what it just wrote.
 */
export class KnexRelationTupleStore implements RelationTupleStore {
  constructor(
    private readonly context: KnexContext,
    private readonly placed: Placed,
  ) {}

  async write(tuples: readonly RelationTuple[]): Promise<void> {
    if (tuples.length === 0) {
      return;
    }

    await this.table()
      .insert(tuples.map(rowOf))
      .onConflict([...COLUMNS])
      .ignore();
  }

  async delete(tuples: readonly RelationTuple[]): Promise<void> {
    if (tuples.length === 0) {
      return;
    }

    await this.table()
      .whereIn(
        [...COLUMNS],
        tuples.map((tuple) => [tuple.object, tuple.relation, tuple.subject]),
      )
      .delete();
  }

  readByObject(object: string, relation: string): Promise<readonly RelationTuple[]> {
    return this.table()
      .select(...COLUMNS)
      .where({ object, relation })
      .orderBy('subject');
  }

  readBySubject(subject: string): Promise<readonly RelationTuple[]> {
    return this.table()
      .select(...COLUMNS)
      .where({ subject })
      .orderBy(['object', 'relation']);
  }

  private table(): Knex.QueryBuilder<RelationTuple, RelationTuple[]> {
    return this.context
      .executor()<RelationTuple, RelationTuple[]>(RELATION_TUPLES_TABLE)
      .withSchema(this.placed.schema);
  }
}

/** Only the three columns: a tuple given with more properties stores nothing else. */
function rowOf({ object, relation, subject }: RelationTuple): RelationTuple {
  return { object, relation, subject };
}
