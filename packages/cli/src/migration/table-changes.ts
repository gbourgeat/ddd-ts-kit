import type { SqlStatement } from './sql-statement.js';
import type { TableChange } from './table-change.js';

const NAME = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*)`;

const ALTER_TABLE = new RegExp(
  String.raw`^ALTER TABLE (?:IF EXISTS )?(?:ONLY )?(?:${NAME} ?\. ?)?(${NAME}) (.+)$`,
  'i',
);

const ADD_KEY = new RegExp(String.raw`^ADD (?:CONSTRAINT ${NAME} )?PRIMARY KEY\b`, 'i');
const DROP_CONSTRAINT = new RegExp(String.raw`^DROP CONSTRAINT (?:IF EXISTS )?(${NAME})`, 'i');
const DROP_COLUMN = new RegExp(String.raw`^DROP COLUMN (?:IF EXISTS )?(${NAME})`, 'i');

/** A quoted name, a string, a parenthesis, a comma, or anything else: the actions of one ALTER TABLE are split on the commas outside parentheses. */
const PIECES = /"(?:[^"]|"")*"|'(?:[^']|'')*'|[(),]|[^"'(),]+/g;

/**
 * The actions of the `ALTER TABLE` statements of a migration that add a primary key, drop a
 * constraint or drop a column, in the order of the statements. The actions of one statement share
 * its position: PostgreSQL drops before it adds within a statement.
 */
export function tableChanges(statements: readonly SqlStatement[]): TableChange[] {
  return statements.flatMap((statement, position) => {
    const [, table, actions] = ALTER_TABLE.exec(statement.text) ?? [];

    if (table === undefined || actions === undefined) {
      return [];
    }

    return actionsOf(actions).flatMap((action) => {
      const change = changeOf(action);

      return change === undefined ? [] : [{ ...change, table: unquoted(table), position, statement }];
    });
  });
}

function changeOf(action: string): Pick<TableChange, 'kind' | 'name'> | undefined {
  const constraint = DROP_CONSTRAINT.exec(action)?.[1];
  const column = DROP_COLUMN.exec(action)?.[1];

  if (constraint !== undefined) {
    return { kind: 'drop-constraint', name: unquoted(constraint) };
  }

  if (column !== undefined) {
    return { kind: 'drop-column', name: unquoted(column) };
  }

  return ADD_KEY.test(action) ? { kind: 'add-key', name: '' } : undefined;
}

function actionsOf(text: string): string[] {
  const actions: string[] = [];
  let action = '';
  let depth = 0;

  for (const [piece] of text.matchAll(PIECES)) {
    depth += piece === '(' ? 1 : piece === ')' ? -1 : 0;

    if (piece === ',' && depth === 0) {
      actions.push(action.trim());
      action = '';
    } else {
      action += piece;
    }
  }

  return [...actions, action.trim()];
}

function unquoted(name: string): string {
  return name.startsWith('"') ? name.slice(1, -1).replaceAll('""', '"') : name.toLowerCase();
}
