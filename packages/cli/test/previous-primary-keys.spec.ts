import { describe, expect, it } from 'vitest';
import { previousPrimaryKeys } from '../src/migration/previous-primary-keys.js';

const SQL = 'migrations/0002_change-key.sql';

const snapshot = (id: string, prevId: string, tables: Record<string, unknown>): string =>
  JSON.stringify({ id, prevId, tables });

describe('the primary keys of the snapshot a migration was generated from', () => {
  it('reads a primary key column and a composite key of the parent snapshot', () => {
    const files = new Map([
      [
        'migrations/meta/0001_snapshot.json',
        snapshot('parent', 'root', {
          'public.invoices': { name: 'invoices', columns: { id: { name: 'id', primaryKey: true } } },
          'public.lines': {
            name: 'lines',
            columns: { position: { name: 'position' } },
            compositePrimaryKeys: { lines_pk: { name: 'lines_pk', columns: ['invoice_id', 'position', 3] } },
          },
          'public.broken': { columns: {} },
        }),
      ],
      ['migrations/meta/0002_snapshot.json', snapshot('child', 'parent', {})],
    ]);

    expect([...previousPrimaryKeys(files, SQL)]).toEqual([
      ['invoices_pkey', ['id']],
      ['lines_pk', ['invoice_id', 'position']],
    ]);
  });

  it('is empty without its own snapshot, with an unreadable one, or when the parent is missing', () => {
    expect(previousPrimaryKeys(new Map(), SQL).size).toBe(0);
    expect(previousPrimaryKeys(new Map([['migrations/meta/0002_snapshot.json', '{ not json']]), SQL).size).toBe(0);

    expect(
      previousPrimaryKeys(new Map([['migrations/meta/0002_snapshot.json', snapshot('child', 'gone', {})]]), SQL).size,
    ).toBe(0);
  });
});
