import { describe, expect, it } from 'vitest';
import { InMemorySubjectKeyStore, eraseDataSubject, type ProjectionToRebuild } from '../src';

function projection(name: string, order: string[]): ProjectionToRebuild {
  return {
    name,
    rebuild: async () => {
      order.push(name);

      return { replayed: 1 };
    },
  };
}

function failing(name: string): ProjectionToRebuild {
  return { name, rebuild: () => Promise.reject(new Error(`${name} unreadable`)) };
}

describe('eraseDataSubject, a rebuild that fails', () => {
  it('runs the rebuilds after it, then throws its failure', async () => {
    const order: string[] = [];
    const keys = new InMemorySubjectKeyStore();

    await keys.keyFor('patient-1');

    await expect(
      eraseDataSubject('patient-1', {
        keys,
        rebuilds: [projection('first', order), failing('broken'), projection('last', order)],
      }),
    ).rejects.toThrow('broken unreadable');

    expect(order).toEqual(['first', 'last']);
  });

  it('throws the first failure of the rebuilds, once every one of them ran', async () => {
    const order: string[] = [];

    await expect(
      eraseDataSubject('patient-2', {
        rebuilds: [failing('one'), failing('two'), projection('last', order)],
      }),
    ).rejects.toThrow('one unreadable');

    expect(order).toEqual(['last']);
  });

  it('throws the failure of a copy before the one of a rebuild, once everything ran', async () => {
    const order: string[] = [];
    const copy = { name: 'identity.persons', erase: () => Promise.reject(new Error('identity unreachable')) };

    await expect(
      eraseDataSubject('patient-3', { copies: [copy], rebuilds: [failing('broken'), projection('last', order)] }),
    ).rejects.toThrow('identity unreachable');

    expect(order).toEqual(['last']);
  });

  it('completes on a second run, once the rebuild passes', async () => {
    const keys = new InMemorySubjectKeyStore();
    let passes = false;

    const flaky: ProjectionToRebuild = {
      name: 'flaky',
      rebuild: async () => {
        if (!passes) {
          throw new Error('flaky down');
        }

        return { replayed: 2 };
      },
    };

    await keys.keyFor('patient-4');
    await expect(eraseDataSubject('patient-4', { keys, rebuilds: [flaky] })).rejects.toThrow('flaky down');

    passes = true;

    expect(await eraseDataSubject('patient-4', { keys, rebuilds: [flaky] })).toEqual({
      erased: false,
      copies: {},
      rebuilt: { flaky: 2 },
    });
  });
});
