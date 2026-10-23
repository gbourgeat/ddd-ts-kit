import path from 'node:path';
import { isRecord } from '../check/support/is-record';
import type { KnownPrimaryKeys } from './known-primary-keys';

/**
 * The primary keys recorded by the snapshot a migration was generated from (the one its own
 * snapshot names as `prevId`), read from the files of the migrations folder: a column marked
 * `primaryKey` gives `<table>_pkey`, as PostgreSQL names it, and `compositePrimaryKeys` their own
 * names. Empty when a snapshot is missing or of another shape.
 */
export function previousPrimaryKeys(files: ReadonlyMap<string, string>, sqlPath: string): KnownPrimaryKeys {
  const meta = `${path.posix.dirname(sqlPath)}/meta/`;
  const prefix = path.posix.basename(sqlPath, '.sql').split('_')[0] ?? '';
  const own = parsed(files.get(`${meta}${prefix}_snapshot.json`));
  const prevId = isRecord(own) ? own['prevId'] : undefined;

  for (const [file, content] of files) {
    const snapshot = file.startsWith(meta) && file.endsWith('_snapshot.json') ? parsed(content) : undefined;

    if (isRecord(snapshot) && typeof prevId === 'string' && snapshot['id'] === prevId) {
      return new Map(Object.values(recordAt(snapshot, 'tables')).flatMap(keysOf));
    }
  }

  return new Map();
}

function keysOf(table: unknown): [string, string[]][] {
  const name = isRecord(table) ? table['name'] : undefined;

  if (!isRecord(table) || typeof name !== 'string') {
    return [];
  }

  const columns = Object.values(recordAt(table, 'columns')).filter(
    (column) => isRecord(column) && column['primaryKey'] === true,
  );

  const single: [string, string[]][] = columns.length === 0 ? [] : [[`${name}_pkey`, columns.flatMap(nameOf)]];
  const composite = Object.values(recordAt(table, 'compositePrimaryKeys')).flatMap(compositeOf);

  return [...single, ...composite];
}

function compositeOf(key: unknown): [string, string[]][] {
  const name = isRecord(key) ? key['name'] : undefined;
  const columns = isRecord(key) ? key['columns'] : undefined;

  return typeof name === 'string' && Array.isArray(columns)
    ? [[name, columns.filter((column) => typeof column === 'string')]]
    : [];
}

function nameOf(column: unknown): string[] {
  const name = isRecord(column) ? column['name'] : undefined;

  return typeof name === 'string' ? [name] : [];
}

function recordAt(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const found = value[key];

  return isRecord(found) ? found : {};
}

function parsed(text: string | undefined): unknown {
  try {
    return text === undefined ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}
