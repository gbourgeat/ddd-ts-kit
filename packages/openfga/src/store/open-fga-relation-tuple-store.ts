import {
  parseSubject,
  tupleKey,
  type RelationTuple,
  type RelationTupleStore,
  type Schema,
} from '@ddd-ts-kit/auth/rebac';
import type { OpenFgaApi, OpenFgaTupleKey } from '../client/open-fga-api.js';

/** OpenFGA answers a page of tuples at a time; this many, at most, per read. */
const PAGE_SIZE = 100;

/** How many tuples one write sends: the limit of a write of the OpenFGA API. */
const CHUNK = 100;

/**
 * The relation tuples of `@ddd-ts-kit/auth` in an OpenFGA store, held to the same contract as the
 * tuple store of PostgreSQL. Writing a tuple twice and deleting one that is not there change
 * nothing (the conflict options of OpenFGA 1.10 and later). A write is a call to a service: it
 * does not join the transaction of the unit of work, so a tuple written with an aggregate goes
 * through the outbox or is retried, and must be idempotent, as it is here.
 */
export class OpenFgaRelationTupleStore implements RelationTupleStore {
  constructor(
    private readonly client: OpenFgaApi,
    private readonly schema: Schema,
  ) {}

  async write(tuples: readonly RelationTuple[]): Promise<void> {
    for (const chunk of chunksOf(distinct(tuples))) {
      await this.client.write({ writes: chunk }, { conflict: { onDuplicateWrites: 'ignore' } });
    }
  }

  async delete(tuples: readonly RelationTuple[]): Promise<void> {
    for (const chunk of chunksOf(distinct(tuples))) {
      await this.client.write({ deletes: chunk }, { conflict: { onMissingDeletes: 'ignore' } });
    }
  }

  readByObject(object: string, relation: string): Promise<readonly RelationTuple[]> {
    return this.readAll({ object, relation });
  }

  /**
   * OpenFGA reads by subject only within one object type: one read per relation of the schema
   * that accepts the kind of the subject (`user`, or the userset `group#member`).
   */
  async readBySubject(subject: string): Promise<readonly RelationTuple[]> {
    const read = this.relationsAccepting(subject).map(([type, relation]) =>
      this.readAll({ user: subject, relation, object: `${type}:` }),
    );

    return (await Promise.all(read)).flat();
  }

  private relationsAccepting(subject: string): readonly (readonly [string, string])[] {
    const { type, relation } = parseSubject(subject);
    const kind = relation === undefined ? type : `${type}#${relation}`;

    return this.schema.types().flatMap((object) =>
      Object.entries(this.schema.relations(object))
        .filter(([, subjects]) => subjects.includes(kind))
        .map(([name]) => [object, name] as const),
    );
  }

  private async readAll(filter: { readonly user?: string; readonly relation: string; readonly object: string }) {
    const tuples: RelationTuple[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await this.client.read(filter, {
        pageSize: PAGE_SIZE,
        ...(continuationToken === undefined ? {} : { continuationToken }),
      });

      tuples.push(...page.tuples.map(({ key }) => ({ object: key.object, relation: key.relation, subject: key.user })));
      continuationToken = page.continuation_token === '' ? undefined : page.continuation_token;
    } while (continuationToken !== undefined);

    return tuples;
  }
}

/** Each tuple once: OpenFGA refuses a request that names one tuple twice, whatever its conflict options. */
function distinct(tuples: readonly RelationTuple[]): readonly OpenFgaTupleKey[] {
  const keys = new Map(
    tuples.map(({ object, relation, subject }) => [
      tupleKey({ object, relation, subject }),
      { object, relation, user: subject },
    ]),
  );

  return [...keys.values()];
}

function chunksOf(keys: readonly OpenFgaTupleKey[]): readonly OpenFgaTupleKey[][] {
  const chunks: OpenFgaTupleKey[][] = [];

  for (let start = 0; start < keys.length; start += CHUNK) {
    chunks.push(keys.slice(start, start + CHUNK));
  }

  return chunks;
}
