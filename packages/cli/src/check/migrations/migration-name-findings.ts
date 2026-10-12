import type { Finding } from '../model/finding.js';
import type { Migration } from './migration-folder.js';

/** A number that orders the migration, a separator, then what it does: `20261012093000_add-invoices`. */
const NAMED = /^(\d+)[_-][A-Za-z0-9][\w-]*$/;

/**
 * Migrations are applied in the order of their names: each starts with the number that orders
 * it (a timestamp in a generated project) and says what it does, and no two share a number,
 * which is what two branches produce when the number is an index.
 */
export function migrationNameFindings(migrations: readonly Migration[]): (readonly [Migration, Finding])[] {
  const prefixes = migrations.map((migration) => NAMED.exec(migration.name)?.[1]);

  return migrations.flatMap((migration, index) => {
    const prefix = prefixes[index];

    if (prefix !== undefined && prefixes.indexOf(prefix) === index) {
      return [];
    }

    return [[migration, prefix === undefined ? unnamed(migration) : shared(migration, prefix)] as const];
  });
}

function unnamed(migration: Migration): Finding {
  return {
    line: 1,
    message: `The migration "${migration.name}" is not named \`<timestamp>_<what-it-does>\`: nothing orders it among the others.`,
    fix: 'Create a migration with `npm run db:generate <what-it-does>`, which names it by the time it was generated, never by hand.',
  };
}

function shared(migration: Migration, prefix: string): Finding {
  return {
    line: 1,
    message: `The migration "${migration.name}" shares the number ${prefix} with another one: the order between them is a guess.`,
    fix: 'Two branches each added a migration numbered by an index. Keep the one of the main branch, delete yours and generate it again with `npm run db:generate <what-it-does>`, which names it by a timestamp.',
  };
}
