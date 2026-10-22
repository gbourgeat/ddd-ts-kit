import { describe, expect, it } from 'vitest';
import { previousPrimaryKeys } from '../src/migration/previous-primary-keys';

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

  it('skips the entries of a snapshot written in another shape', () => {
    const files = new Map([
      ['migrations/0001_create.sql', 'CREATE TABLE orders ();'],
      [
        'migrations/meta/0001_snapshot.json',
        snapshot('parent', 'root', {
          'public.text': 'not a table',
          'public.unnamed': { name: 7 },
          'public.orders': {
            name: 'orders',
            columns: { id: { name: 'id', primaryKey: true }, other: { name: 3, primaryKey: true }, flag: true },
            compositePrimaryKeys: {
              odd: 'not a key',
              unnamed: { columns: ['a'] },
              flat: { name: 'flat', columns: 'a' },
            },
          },
        }),
      ],
      ['migrations/meta/0002_snapshot.json', snapshot('child', 'parent', {})],
    ]);

    expect([...previousPrimaryKeys(files, SQL)]).toEqual([['orders_pkey', ['id']]]);
  });
});
