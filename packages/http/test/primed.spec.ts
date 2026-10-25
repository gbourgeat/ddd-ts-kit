import { describe, expect, it } from 'vitest';
import { primed } from '../src/pipeline/primed';

function cursor(): { readonly rows: AsyncGenerator<number>; readonly reads: { opened: number; closed: number } } {
  const reads = { opened: 0, closed: 0 };

  async function* rows(): AsyncGenerator<number> {
    reads.opened += 1;

    try {
      yield 1;
      yield 2;
      yield 3;
    } finally {
      reads.closed += 1;
    }
  }

  return { rows: rows(), reads };
}

describe('a primed list', () => {
  it('gives every item, the first one read in advance', async () => {
    const { rows } = cursor();
    const read: number[] = [];

    for await (const row of await primed(rows)) {
      read.push(row);
    }

    expect(read).toEqual([1, 2, 3]);
  });

  it('closes its cursor when it is closed before any item is taken', async () => {
    const { rows, reads } = cursor();

    await (await primed(rows))[Symbol.asyncIterator]().return?.();

    expect(reads).toEqual({ opened: 1, closed: 1 });
  });

  it('is closed without fault when its items cannot be closed', async () => {
    const endless: AsyncIterable<number> = {
      [Symbol.asyncIterator]: () => ({ next: async () => ({ done: false, value: 1 }) }),
    };

    expect(await (await primed(endless))[Symbol.asyncIterator]().return?.()).toEqual({ done: true, value: undefined });
  });

  it('closes its cursor when its reader stops halfway, as a client that goes away', async () => {
    const { rows, reads } = cursor();

    for await (const row of await primed(rows)) {
      if (row === 2) {
        break;
      }
    }

    expect(reads).toEqual({ opened: 1, closed: 1 });
  });
});
