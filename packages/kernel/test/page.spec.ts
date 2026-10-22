import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_LIMITS,
  INVALID_PAGE_REQUEST,
  InvalidPageRequestError,
  cursorPage,
  decodeCursor,
  encodeCursor,
  mapPage,
  offsetPage,
  pageOf,
  type Page,
  type PageRequest,
  type Sort,
} from '../src';

type OrderField = 'placedAt' | 'total';

describe('offsetPage', () => {
  it('starts at the beginning with the default size', () => {
    expect(offsetPage()).toEqual({ kind: 'offset', offset: 0, limit: DEFAULT_PAGE_LIMITS.defaultSize, sort: [] });
  });

  it('keeps what the caller asked for', () => {
    const sort: Sort<OrderField>[] = [{ field: 'placedAt', direction: 'desc' }];

    expect(offsetPage({ offset: 40, limit: 10, sort })).toEqual({ kind: 'offset', offset: 40, limit: 10, sort });
  });

  it.each([{ offset: -1 }, { offset: 1.5 }, { limit: 0 }, { limit: 101 }, { limit: Number.NaN }])(
    'refuses %o with a stable code',
    (input) => {
      expect(() => offsetPage(input)).toThrow(InvalidPageRequestError);
      expect(() => offsetPage(input)).toThrow(expect.objectContaining({ code: INVALID_PAGE_REQUEST }));
    },
  );

  it('applies the limits of the route that calls it', () => {
    const limits = { defaultSize: 5, maxSize: 10 };

    expect(offsetPage({}, limits).limit).toBe(5);
    expect(() => offsetPage({ limit: 11 }, limits)).toThrow(InvalidPageRequestError);
  });
});

describe('cursorPage', () => {
  it('asks for the first page without cursor', () => {
    expect(cursorPage({ limit: 50 })).toEqual({ kind: 'cursor', limit: 50, sort: [] });
  });

  it('carries the opaque cursor of the previous page', () => {
    expect(cursorPage({ cursor: 'b3JkZXItNDI' })).toMatchObject({ kind: 'cursor', cursor: 'b3JkZXItNDI' });
  });

  it('refuses an empty cursor and a size beyond the maximum', () => {
    expect(() => cursorPage({ cursor: '' })).toThrow(InvalidPageRequestError);
    expect(() => cursorPage({ limit: 1000 })).toThrow(InvalidPageRequestError);
  });
});

describe('Page', () => {
  it('is the one answer of both variants', () => {
    const answer = (request: PageRequest): Page<string> =>
      request.kind === 'offset' ? pageOf(['a', 'b'], { total: 2 }) : pageOf(['a', 'b'], { nextCursor: 'c' });

    expect(answer(offsetPage())).toEqual({ items: ['a', 'b'], total: 2 });
    expect(answer(cursorPage())).toEqual({ items: ['a', 'b'], nextCursor: 'c' });
    expect(pageOf([])).toEqual({ items: [] });
  });

  it('maps its items and keeps the rest', () => {
    expect(mapPage(pageOf([1, 2], { total: 9, nextCursor: 'n' }), (item) => `#${item}`)).toEqual({
      items: ['#1', '#2'],
      total: 9,
      nextCursor: 'n',
    });
  });
});

describe('a cursor', () => {
  it('comes back as the position it was made from, opaque in between', () => {
    const position = { placedAt: '2026-03-01T10:00:00.000Z', total: 30, paid: true, note: null, id: 'ordre-é' };

    const cursor = encodeCursor(position);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual(position);
  });

  it.each([
    ['not base64 json', 'abc'],
    ['a list', encodeCursor({ id: 'x' }).slice(0, 4)],
    ['a json list', Buffer.from('["id"]').toString('base64url')],
    ['a nested value', Buffer.from('{"id":{"$gt":""}}').toString('base64url')],
    ['json null', Buffer.from('null').toString('base64url')],
  ])('is refused when it is %s', (_case, cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(InvalidPageRequestError);
  });
});
