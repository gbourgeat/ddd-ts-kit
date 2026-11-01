import type { FakeIndex } from './fake-index';
import { matches } from './fake-query';
import { compareAs, typeAt, valueAt } from './fake-values';

type Body = Readonly<Record<string, unknown>>;

interface Hit {
  readonly _index: string;
  readonly _id: string;
  readonly _source: Body;
  readonly order: readonly unknown[];
}

interface Reached {
  readonly index: FakeIndex;
  readonly name: string;
  readonly filters: readonly (Body | undefined)[];
}

interface SortField {
  readonly path: string;
  readonly order: string;
  readonly missing: string;
}

/**
 * The answer of a `_search` over the indices it reached: an index reached through an alias that
 * filters keeps the documents one of its filters matches, the query keeps those it matches, then
 * the sort, `from` and `size`, and the total unless `track_total_hits` is false.
 */
export function searched(reached: readonly Reached[], body: Body): Body {
  const sort = sortOf(body['sort']);
  const query = (body['query'] ?? { match_all: {} }) as Body;

  const hits: Hit[] = reached.flatMap(({ index, name, filters }) =>
    [...index.documents]
      .filter(([, { source }]) =>
        filters.some((filter) => filter === undefined || matches(filter, source, index.properties)),
      )
      .filter(([, { source }]) => matches(query, source, index.properties))
      .map(([id, { source }]) => ({
        _index: name,
        _id: id,
        _source: structuredClone(source),
        order: sort.map(({ path }) => [typeAt(index.properties, path), valueAt(source, path)]),
      })),
  );

  hits.sort((left, right) => ordered(sort, left, right));

  const from = Number(body['from'] ?? 0);
  const page = hits.slice(from, from + Number(body['size'] ?? 10)).map(({ order: _order, ...hit }) => hit);

  return {
    hits: {
      ...(body['track_total_hits'] === false ? {} : { total: { value: hits.length, relation: 'eq' } }),
      hits: page,
    },
  };
}

function sortOf(written: unknown): SortField[] {
  return (Array.isArray(written) ? written : []).flatMap((entry: Body) =>
    Object.entries(entry).map(([path, options]) => {
      const { order = 'asc', missing = '_last' } = options as Record<string, string | undefined>;

      return { path, order, missing };
    }),
  );
}

function ordered(sort: readonly SortField[], left: Hit, right: Hit): number {
  for (const [position, { order, missing }] of sort.entries()) {
    const [type, a] = left.order[position] as [string, unknown];
    const [, b] = right.order[position] as [string, unknown];
    const absent = (value: unknown): boolean => value === undefined || value === null;

    if (absent(a) || absent(b)) {
      const last = Number(absent(a)) - Number(absent(b));

      if (last !== 0) {
        return missing === '_first' ? -last : last;
      }

      continue;
    }

    const compared = compareAs(type, a, b);

    if (compared !== 0) {
      return order === 'desc' ? -compared : compared;
    }
  }

  return 0;
}
