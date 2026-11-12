import { comesAfter } from './comes-after';
import type { NamedOrm, OrderedMigration } from './ordered-migration';

/** The migrations as their tool runs them. */
export function inOrder(orm: NamedOrm, migrations: readonly OrderedMigration[]): OrderedMigration[] {
  return [...migrations].sort((left, right) =>
    left.key === right.key ? 0 : comesAfter(orm, left.key, right.key) ? 1 : -1,
  );
}
