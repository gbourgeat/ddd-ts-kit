import { describe, expect, it } from 'vitest';
import {
  Criteria,
  cursorPage,
  decodeCursor,
  evaluateCriteria,
  offsetPage,
  pageOfPlan,
  planCriteria,
  type Page,
} from '../src';
import { catalogue, p1, p2, products, type ProductRow } from './support/products';

const all = Criteria.of<ProductRow>();

const skus = (criteria: Criteria<ProductRow>): string[] =>
  evaluateCriteria(products, catalogue, criteria.page(offsetPage({ limit: 50 }))).items.map(({ sku }) => sku);

/** Every page of a cursor read, followed from the first to the one that names no next. */
function pagesOf(criteria: Criteria<ProductRow>, limit: number): string[][] {
  const pages: string[][] = [];
  let cursor: string | undefined;

  do {
    const request = cursor === undefined ? cursorPage({ limit }) : cursorPage({ limit, cursor });
    const page = evaluateCriteria(products, catalogue, criteria.page(request));

    pages.push(page.items.map(({ sku }) => sku));
    cursor = page.nextCursor;
  } while (cursor !== undefined && pages.length <= catalogue.length);

  return pages;
}

function nextCursorOf(page: Page<ProductRow>): string {
  if (page.nextCursor === undefined) {
    throw new Error('Expected a page followed by another');
  }

  return page.nextCursor;
}

describe('evaluateCriteria, paging by cursor', () => {
  const sorts = [
    ['texts', all.orderBy('name')],
    ['decimals', all.orderBy('price')],
    ['decimals, descending', all.orderBy('price', 'desc')],
    ['booleans', all.orderBy('active')],
    ['booleans, descending', all.orderBy('active', 'desc')],
    ['a nullable boolean', all.orderBy('featured')],
    ['a nullable boolean, descending', all.orderBy('featured', 'desc')],
    ['a nullable text', all.orderBy('shelf')],
    ['a nullable text, descending', all.orderBy('shelf', 'desc')],
    ['nullable instants', all.orderBy('restockedAt')],
    ['nullable instants, descending', all.orderBy('restockedAt', 'desc')],
    ['two fields', all.orderBy('stock').orderBy('price', 'desc')],
    ['a nullable field, then a boolean', all.orderBy('shelf').orderBy('active', 'desc')],
  ] as const;

  it.each(sorts)('walks every row once, in order, whatever the page size, sorted by %s', (_label, criteria) => {
    const whole = skus(criteria);

    for (const limit of [1, 2, 3]) {
      const pages = pagesOf(criteria, limit);

      expect(pages.flat()).toEqual(whole);
      expect(pages.at(-1)?.length).toBeGreaterThan(0);
      expect(pages.slice(0, -1).every((page) => page.length === limit)).toBe(true);
    }
  });

  it('walks only the rows its filters keep', () => {
    const criteria = all.where('price', 'gte', '0').orderBy('price', 'desc');

    expect(pagesOf(criteria, 2)).toEqual([['p6', 'p1'], ['p2', 'p5'], ['p4']]);
  });

  it('writes in its cursor the sort values of the last row, an instant as ISO text and a null as null', () => {
    const first = evaluateCriteria(
      products,
      catalogue,
      all.orderBy('restockedAt', 'desc').page(cursorPage({ limit: 1 })),
    );

    const third = evaluateCriteria(
      products,
      catalogue,
      all.orderBy('restockedAt', 'desc').page(cursorPage({ limit: 3 })),
    );

    expect(first.total).toBeUndefined();
    expect(decodeCursor(nextCursorOf(first))).toEqual({ restockedAt: null, sku: 'p5' });
    expect(decodeCursor(nextCursorOf(third))).toEqual({ restockedAt: '2026-10-01T00:00:00.000Z', sku: 'p4' });
  });

  it('plans the rows past the cursor as a predicate a store can translate, nulls last when ascending', () => {
    const first = evaluateCriteria(products, catalogue, all.orderBy('shelf').page(cursorPage({ limit: 3 })));

    const plan = planCriteria(
      products,
      all.orderBy('shelf').page(cursorPage({ limit: 3, cursor: nextCursorOf(first) })),
    );

    expect(first.items.map(({ sku }) => sku)).toEqual(['p1', 'p5', 'p3']);

    expect(plan.seek).toEqual({
      kind: 'or',
      parts: [
        {
          kind: 'or',
          parts: [
            { kind: 'test', field: 'shelf', operator: 'gt', value: 'B', negated: false },
            { kind: 'test', field: 'shelf', operator: 'isNull', value: true, negated: false },
          ],
        },
        {
          kind: 'and',
          parts: [
            { kind: 'test', field: 'shelf', operator: 'eq', value: 'B', negated: false },
            { kind: 'test', field: 'sku', operator: 'gt', value: 'p3', negated: false },
          ],
        },
      ],
    });
  });
});

describe('pageOfPlan', () => {
  it('answers a cursor page with no next cursor when the store answered no row more than the page', () => {
    const plan = planCriteria(products, all.page(cursorPage({ limit: 2 })));

    expect(pageOfPlan(plan, [])).toEqual({ items: [] });
    expect(pageOfPlan(plan, [p1, p2])).toEqual({ items: [p1, p2] });
  });

  it('answers an offset page without a total when none was counted', () => {
    const plan = planCriteria(products, all.page(offsetPage({ limit: 1 })));

    expect(pageOfPlan(plan, [p1, p2])).toEqual({ items: [p1] });
    expect(pageOfPlan(plan, [p1, p2], 7)).toEqual({ items: [p1], total: 7 });
  });
});
