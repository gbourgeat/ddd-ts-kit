import { UniqueViolationError } from '@ddd-ts-kit/kernel';

/** The aggregate whose row the first save created, or skipped. */
export interface CreatedKey {
  readonly id: string | number;
  /** How many rows hold the id: a count on the table, confined to the tenant of the work on a tenant table. */
  holders(): Promise<number>;
}

/**
 * The rows `createMany({ data: [row], skipDuplicates: true })` wrote for the first save of an
 * aggregate, as `optimisticUpdate` reads them. `skipDuplicates` names no conflict target: it
 * also skips a row that takes a value another row holds under another unique constraint (an
 * email). When nothing was written and no row holds the id, that is what happened: it is
 * raised as a `UniqueViolationError` (`CONFLICT`), as the other ORM answer it, not read as a
 * lost update.
 */
export async function rowsCreated(created: { readonly count: number }, key: CreatedKey): Promise<number> {
  if (created.count === 0 && (await key.holders()) === 0) {
    throw new UniqueViolationError(key.id);
  }

  return created.count;
}
