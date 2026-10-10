import { HydrationTimeoutError } from './hydration-timeout-error.js';
import type { HydrationRun } from './hydration-run.js';
import { property } from './property.js';

export interface Relation<Row, Name extends string, Related> {
  readonly name: Name;
  readonly keyOf: (row: Row) => string | null | undefined;
  readonly lookup: (ids: readonly string[]) => Promise<ReadonlyMap<string, Related>>;
}

type Found<Name extends string, Related> = { readonly [Key in Name]?: Related };

/**
 * What one relation adds to each row, in the order of the rows: one lookup for the page, with
 * each identifier once, and none when no row has a key. A lookup that fails is recorded in
 * the run and adds nothing.
 */
export async function loadRelation<Row, Name extends string, Related>(
  relation: Relation<Row, Name, Related>,
  rows: readonly Row[],
  run: HydrationRun,
): Promise<readonly Found<Name, Related>[]> {
  const keys = rows.map((row) => relation.keyOf(row) ?? undefined);
  const ids = [...new Set(keys.filter((key) => key !== undefined))];
  const found = ids.length === 0 ? new Map<string, Related>() : await looked(relation, ids, run);

  return keys.map((key) => {
    const related = key === undefined ? undefined : found.get(key);

    return related === undefined ? {} : property(relation.name, related);
  });
}

async function looked<Row, Name extends string, Related>(
  { name, lookup }: Relation<Row, Name, Related>,
  ids: readonly string[],
  run: HydrationRun,
): Promise<ReadonlyMap<string, Related>> {
  try {
    return await within(lookup(ids), name, run.policies.get(name)?.timeoutMs);
  } catch (error) {
    run.failures.set(name, error);

    return new Map<string, Related>();
  }
}

function within<T>(answer: Promise<T>, relation: string, timeoutMs: number | undefined): Promise<T> {
  if (timeoutMs === undefined) {
    return answer;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new HydrationTimeoutError(relation, timeoutMs));
    }, timeoutMs);

    answer.then(resolve, reject).finally(() => {
      clearTimeout(timer);
    });
  });
}
