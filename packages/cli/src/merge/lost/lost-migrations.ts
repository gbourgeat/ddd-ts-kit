import type { MergeFinding } from './merge-finding';
import type { MergeSides } from './merge-sides';

/** A migration file: under a `migrations/` folder, outside the `meta/` of drizzle-kit. */
const MIGRATION = /(?:^|\/)migrations\/(?!(?:.*\/)?meta\/)(.+)$/;

/**
 * The migrations of a side whose description no migration of the result has. A migration is
 * known by its description, its name without its number and without `working-`: the trunk
 * replaces a working migration by the real one, a replay renumbers it, and both keep it.
 */
export function lostMigrations({ base, ours, theirs, result }: MergeSides): MergeFinding[] {
  const inBase = descriptionsOf(base);
  const inOurs = descriptionsOf(ours);
  const inTheirs = descriptionsOf(theirs);
  const inResult = descriptionsOf(result);

  return [...new Map([...inTheirs, ...inOurs])]
    .filter(([description]) => !inResult.has(description))
    .filter(([description]) => !(inBase.has(description) && (!inOurs.has(description) || !inTheirs.has(description))))
    .map(
      ([description, file]): MergeFinding => ({
        kind: 'migration-lost',
        file,
        line: 1,
        side: inOurs.has(description) ? 'ours' : 'theirs',
        text: `migration "${description}" missing from the result`,
      }),
    );
}

/** Each description, with the first file that carries it. */
function descriptionsOf(files: ReadonlyMap<string, string>): Map<string, string> {
  const descriptions = new Map<string, string>();

  for (const file of files.keys()) {
    const description = descriptionOf(file);

    if (description !== undefined && !descriptions.has(description)) {
      descriptions.set(description, file);
    }
  }

  return descriptions;
}

/** `0003_working-add-payments.sql`, `20260101120000_add-payments.ts`, `1700000000000-AddPayments.ts`, `<stamp>_add_payments/migration.sql`. */
function descriptionOf(file: string): string | undefined {
  const inFolder = MIGRATION.exec(file)?.[1];

  if (inFolder === undefined) {
    return undefined;
  }

  const segments = inFolder.split('/');
  const name = segments.length > 1 && segments.at(-1) === 'migration.sql' ? segments.at(-2) : segments.at(-1);

  const description = (name ?? '')
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[_-]/, '')
    .replace(/^working[_-]/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return description === '' ? undefined : description;
}
