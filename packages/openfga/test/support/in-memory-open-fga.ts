import type { OpenFgaApi, OpenFgaTupleKey } from '../../src';

const keyOf = ({ user, relation, object }: OpenFgaTupleKey): string => `${object}#${relation}@${user}`;

/**
 * The tuple endpoints of OpenFGA, in memory and as its API behaves: a read by user needs an
 * object type, pages of `pageSize` with a continuation token, and the conflict options of a
 * write. Checks are not evaluated here: the integration specs ask a real server.
 */
export class InMemoryOpenFga implements OpenFgaApi {
  readonly tuples = new Map<string, OpenFgaTupleKey>();

  readonly models: unknown[] = [];

  check(body: OpenFgaTupleKey): Promise<{ allowed?: boolean }> {
    return Promise.reject(new Error(`${body.relation} is evaluated by a real server`));
  }

  listObjects(body: { user: string; relation: string; type: string }): Promise<{ objects: readonly string[] }> {
    return Promise.reject(new Error(`${body.relation} is listed by a real server`));
  }

  read(
    body: { user?: string; relation?: string; object?: string },
    options: { continuationToken?: string; pageSize?: number } = {},
  ): Promise<{ tuples: { key: OpenFgaTupleKey }[]; continuation_token: string }> {
    const matching = [...this.tuples.values()]
      .filter((tuple) => matches(tuple, body))
      .sort((a, b) => keyOf(a).localeCompare(keyOf(b)));

    const start = Number(options.continuationToken ?? '0');
    const end = start + (options.pageSize ?? 50);

    return Promise.resolve({
      tuples: matching.slice(start, end).map((key) => ({ key })),
      continuation_token: end < matching.length ? String(end) : '',
    });
  }

  write(
    body: { writes?: OpenFgaTupleKey[]; deletes?: OpenFgaTupleKey[] },
    options: { conflict?: { onDuplicateWrites?: string; onMissingDeletes?: string } } = {},
  ): Promise<unknown> {
    const named = [...(body.writes ?? []), ...(body.deletes ?? [])].map(keyOf);

    if (new Set(named).size !== named.length) {
      return Promise.reject(new Error('duplicate tuple in write'));
    }

    for (const tuple of body.writes ?? []) {
      if (this.tuples.has(keyOf(tuple)) && options.conflict?.onDuplicateWrites !== 'ignore') {
        return Promise.reject(new Error('cannot write a tuple which already exists'));
      }

      this.tuples.set(keyOf(tuple), tuple);
    }

    for (const tuple of body.deletes ?? []) {
      if (!this.tuples.delete(keyOf(tuple)) && options.conflict?.onMissingDeletes !== 'ignore') {
        return Promise.reject(new Error('cannot delete a tuple which does not exist'));
      }
    }

    return Promise.resolve({});
  }

  readLatestAuthorizationModel(): Promise<{ authorization_model?: unknown }> {
    const latest = this.models.at(-1);

    return Promise.resolve(latest === undefined ? {} : { authorization_model: latest });
  }

  writeAuthorizationModel(body: unknown): Promise<{ authorization_model_id: string }> {
    const id = `model-${this.models.length + 1}`;

    this.models.push({ ...Object(body), id });

    return Promise.resolve({ authorization_model_id: id });
  }
}

function matches(
  tuple: OpenFgaTupleKey,
  { user, relation, object }: { user?: string; relation?: string; object?: string },
): boolean {
  if (user !== undefined && object !== undefined && object.endsWith(':')) {
    return (
      tuple.user === user && tuple.object.startsWith(object) && (relation === undefined || tuple.relation === relation)
    );
  }

  if (user !== undefined) {
    throw new Error('the object type is required to read by user');
  }

  return tuple.object === object && (relation === undefined || tuple.relation === relation);
}
