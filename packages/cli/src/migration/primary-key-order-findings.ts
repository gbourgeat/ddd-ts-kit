import type { KnownPrimaryKeys } from './known-primary-keys.js';
import type { PrimaryKeyOrderFinding } from './primary-key-order-finding.js';
import { sqlStatements } from './sql-statements.js';
import type { TableChange } from './table-change.js';
import { tableChanges } from './table-changes.js';

/** PostgreSQL names a key `<table>_pkey`; drizzle-kit names a composite one `<table>_<column>_<column>_pk`. */
const KEY_NAME = /_(?:pkey|pk)$/;

const CUSTOM = 'or write the migration yourself (`npm run db:generate -- <name> --custom`)';

/**
 * The changes of a primary key that a migration of drizzle-kit writes in an order PostgreSQL
 * refuses: the new key of a table added before its old one is dropped (a table has one primary
 * key), and a column dropped before the key that holds it (the column takes the key with it, and
 * the later `DROP CONSTRAINT` finds none). A dropped constraint is a primary key when `known` says
 * so (the snapshot before the migration) or its name ends in `_pkey` or `_pk`; the columns of a
 * key come from `known`, else from the name drizzle-kit gives a composite key.
 */
export function primaryKeyOrderFindings(sql: string, known: KnownPrimaryKeys = new Map()): PrimaryKeyOrderFinding[] {
  const changes = tableChanges(sqlStatements(sql));
  const drops = changes.filter((change) => change.kind === 'drop-constraint' && isKey(change.name, known));

  return changes.flatMap((early) => {
    const condition = mustFollow(early, known);

    const drop = drops.find(
      (key) => key.table === early.table && key.position > early.position && condition?.(key) === true,
    );

    return drop === undefined ? [] : [finding(early, drop)];
  });
}

/** Which later drop of a key the change has to follow: any key of its table for an added key, the key holding it for a dropped column. */
function mustFollow(early: TableChange, known: KnownPrimaryKeys): ((key: TableChange) => boolean) | undefined {
  if (early.kind === 'add-key') {
    return () => true;
  }

  return early.kind === 'drop-column' ? (key) => holdsColumn(key, early.name, known) : undefined;
}

function finding(early: TableChange, drop: TableChange): PrimaryKeyOrderFinding {
  const { table } = early;

  const words =
    early.kind === 'add-key'
      ? {
          message: `The new primary key of "${table}" is added before its old one, "${drop.name}", is dropped: PostgreSQL refuses a second primary key on a table, and the migration fails.`,
          fix: `Drop the old key first: move the DROP CONSTRAINT above the ADD of the new key in this migration, still unapplied, ${CUSTOM}.`,
        }
      : {
          message: `The column "${early.name}" of "${table}" is dropped before the primary key "${drop.name}" that holds it: the column takes the key with it, and the later DROP CONSTRAINT fails.`,
          fix: `Drop the key first: move the DROP CONSTRAINT above the DROP COLUMN in this migration, still unapplied, ${CUSTOM}.`,
        };

  return { table, early: early.statement, drop: drop.statement, ...words };
}

function isKey(constraint: string, known: KnownPrimaryKeys): boolean {
  return known.has(constraint) || KEY_NAME.test(constraint);
}

function holdsColumn(key: TableChange, column: string, known: KnownPrimaryKeys): boolean {
  const columns = known.get(key.name);

  if (columns !== undefined) {
    return columns.includes(column);
  }

  const prefix = `${key.table}_`;
  const named = key.name.startsWith(prefix) && key.name.endsWith('_pk') ? key.name.slice(prefix.length, -3) : '';

  return named !== '' && `_${named}_`.includes(`_${column}_`);
}
