import { describe, expect, it } from '{{tests.module}}';
import { cursorPage, encodeCursor, offsetPage } from '@ddd-ts-kit/kernel';
import type { {{name.pascal}}Sort } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';
import { Fake{{name.pascal}}Reader } from '{{alias.context}}/test/fakes/{{name.kebab}}-reader.fake{{alias.ext}}';

const LINES = [{ id: '{{name.kebab}}-1' }, { id: '{{name.kebab}}-2' }, { id: '{{name.kebab}}-3' }];
const [first, second, third] = LINES;

describe('The reader of {{name.words}}', () => {
  it('shows only what the access scope covers: everything, nothing, some identifiers, a filter', async () => {
    const reader = new Fake{{name.pascal}}Reader(LINES);
    const some = await reader.search({ kind: 'ids', ids: ['{{name.kebab}}-2'] }, offsetPage());
    const filtered = await reader.search({ kind: 'filter', filter: { id: '{{name.kebab}}-3' } }, offsetPage());

    expect(await reader.search({ kind: 'all' }, offsetPage())).toEqual({ items: LINES, total: 3 });
    expect(await reader.search({ kind: 'none' }, offsetPage())).toEqual({ items: [], total: 0 });
    expect(some.items).toEqual([second]);
    expect(filtered.items).toEqual([third]);
  });

  it('pages by offset in the direction of the sort, with the total', async () => {
    const reader = new Fake{{name.pascal}}Reader(LINES);
    const descending = offsetPage({ offset: 1, limit: 2, sort: [{ field: 'id', direction: 'desc' }] });

    expect(await reader.search({ kind: 'all' }, descending)).toEqual({ items: [second, first], total: 3 });
  });

  it('pages by cursor until the last page, which gives no cursor', async () => {
    const reader = new Fake{{name.pascal}}Reader(LINES);
    const opening = await reader.search({ kind: 'all' }, cursorPage<{{name.pascal}}Sort>({ limit: 2 }));
    const closing = await reader.search({ kind: 'all' }, cursorPage<{{name.pascal}}Sort>({ limit: 2, cursor: opening.nextCursor ?? '' }));

    expect(opening.items).toEqual([first, second]);
    expect(closing).toEqual({ items: [third] });
  });

  it('refuses a cursor that is not the cursor of a previous page', async () => {
    const reader = new Fake{{name.pascal}}Reader(LINES);
    const forged = cursorPage<{{name.pascal}}Sort>({ cursor: encodeCursor({ id: 3 }) });

    await expect(reader.search({ kind: 'all' }, forged)).rejects.toMatchObject({ code: 'INVALID_PAGE_REQUEST' });
  });

  // TODO(domain): once the reader reads the real projection, hold its production adapter to the same expectations.
  it.todo('orders by each sort field of the result, then by id');
});
