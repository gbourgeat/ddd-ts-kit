import {
  parseObject,
  tupleKey,
  type RelationTuple,
  type RelationTupleStore,
  type Schema,
} from '@ddd-ts-kit/auth/rebac';
import type { OpenFgaApi, OpenFgaTupleKey } from '../client/open-fga-api';

/** OpenFGA answers a page of tuples at a time; this many, at most, per read. */
const PAGE_SIZE = 100;

/** How many tuples one write sends: the limit of a write of the OpenFGA API. */
const CHUNK = 100;

/**
 * The relation tuples of `@ddd-ts-kit/auth` in an OpenFGA store, held to the same contract as the
 * tuple store of PostgreSQL. A tuple of the kit names its subject alone (`group:eng`) and the
 * schema says what it stands for; OpenFGA wants it in the tuple (`group:eng#member`), so the
 * userset is added on write and removed on read. Writing a tuple twice and deleting one that is
 * not there change nothing (the conflict options of OpenFGA 1.10 and later). A write is a call to
 * a service: it does not join the transaction of the unit of work, so a tuple written with an
 * aggregate goes through the outbox or is retried, and must be idempotent, as it is here.
 */
export class OpenFgaRelationTupleStore implements RelationTupleStore {
  constructor(
    private readonly client: OpenFgaApi,
    private readonly schema: Schema,
  ) {}

  async write(tuples: readonly RelationTuple[]): Promise<void> {
    for (const chunk of chunksOf(distinct(tuples.map((tuple) => this.keyOf(tuple))))) {
      await this.client.write({ writes: chunk }, { conflict: { onDuplicateWrites: 'ignore' } });
    }
  }

  async delete(tuples: readonly RelationTuple[]): Promise<void> {
    for (const chunk of chunksOf(distinct(tuples.map((tuple) => this.keyOf(tuple))))) {
      await this.client.write({ deletes: chunk }, { conflict: { onMissingDeletes: 'ignore' } });
    }
  }

  readByObject(object: string, relation: string): Promise<readonly RelationTuple[]> {
    return this.readAll({ object, relation });
  }

  /**
   * OpenFGA reads by user only within one object type: one read per relation of the schema
   * that accepts the type of the subject, as itself or as what it stands for there.
   */
  async readBySubject(subject: string): Promise<readonly RelationTuple[]> {
    const read = this.relationsAccepting(subject).map(({ type, relation, user }) =>
      this.readAll({ user, relation, object: `${type}:` }),
    );

    return (await Promise.all(read)).flat();
  }

  /** The tuple as OpenFGA stores it: the userset the schema gives the subject in this relation, if any. */
  private keyOf({ object, relation, subject }: RelationTuple): OpenFgaTupleKey {
    const standsFor = this.schema.standsFor(parseObject(object).type, relation, parseObject(subject).type);

    return { object, relation, user: standsFor === undefined ? subject : `${subject}#${standsFor}` };
  }

  private relationsAccepting(subject: string): readonly Accepting[] {
    const subjectType = parseObject(subject).type;

    return this.schema.types().flatMap((type) =>
      Object.keys(this.schema.relations(type)).flatMap((relation) => {
        const standsFor = this.schema.standsFor(type, relation, subjectType);
        const accepted = this.schema.acceptedKindOf(type, relation, subjectType) !== undefined;

        return accepted
          ? [{ type, relation, user: standsFor === undefined ? subject : `${subject}#${standsFor}` }]
          : [];
      }),
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

      tuples.push(...page.tuples.map(({ key }) => tupleOf(key)));
      continuationToken = page.continuation_token === '' ? undefined : page.continuation_token;
    } while (continuationToken !== undefined);

    return tuples;
  }
}

/** One read of OpenFGA: the relation of a type, and the subject as that relation stores it. */
interface Accepting {
  readonly type: string;
  readonly relation: string;
  readonly user: string;
}

/** The tuple as the kit reads it: the subject alone, the userset OpenFGA holds left to the schema. */
function tupleOf({ object, relation, user }: OpenFgaTupleKey): RelationTuple {
  return { object, relation, subject: user.split('#')[0] ?? user };
}

/** Each tuple once: OpenFGA refuses a request that names one tuple twice, whatever its conflict options. */
function distinct(keys: readonly OpenFgaTupleKey[]): readonly OpenFgaTupleKey[] {
  const byKey = new Map(
    keys.map((key) => [tupleKey({ object: key.object, relation: key.relation, subject: key.user }), key]),
  );

  return [...byKey.values()];
}

function chunksOf(keys: readonly OpenFgaTupleKey[]): readonly OpenFgaTupleKey[][] {
  const chunks: OpenFgaTupleKey[][] = [];

  for (let start = 0; start < keys.length; start += CHUNK) {
    chunks.push(keys.slice(start, start + CHUNK));
  }

  return chunks;
}
