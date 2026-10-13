import { describe, expect, it } from 'vitest';
import type { Page } from '@ddd-ts-kit/kernel';
import { everyPage } from '../src/index.js';

/** Three pages of two rows, the cursor of each naming the next one, and every page asked recorded. */
function pagesOf(asked: (string | undefined)[]): (cursor: string | undefined) => Promise<Page<number>> {
  const pages: Readonly<Record<string, Page<number>>> = {
    first: { items: [1, 2], nextCursor: 'b' },
    b: { items: [3, 4], nextCursor: 'c' },
    c: { items: [5] },
  };

  return async (cursor) => {
    asked.push(cursor);

    return pages[cursor ?? 'first'] ?? { items: [] };
  };
}

describe('every page of a search', () => {
  it('gives the items of each page in order, asking for a page only once the one before is read', async () => {
    const asked: (string | undefined)[] = [];
    const items = everyPage(pagesOf(asked));
    const read: number[] = [];

    for await (const item of items) {
      read.push(item);

      if (item === 2) {
        expect(asked).toEqual([undefined]);
      }
    }

    expect(read).toEqual([1, 2, 3, 4, 5]);
    expect(asked).toEqual([undefined, 'b', 'c']);
  });

  it('stops asking when the reader leaves', async () => {
    const asked: (string | undefined)[] = [];

    for await (const item of everyPage(pagesOf(asked))) {
      if (item === 1) {
        break;
      }
    }

    expect(asked).toEqual([undefined]);
  });
});
