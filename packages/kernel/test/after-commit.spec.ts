import { describe, expect, it } from 'vitest';
import { InMemoryUnitOfWork, afterCommit } from '../src';

describe('afterCommit', () => {
  it('waits for the outermost unit of work, runs in the order given, and drops a rejection', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const journal: string[] = [];

    await unitOfWork.run(async () => {
      await afterCommit(async () => void journal.push('first'));
      await unitOfWork.run(() => afterCommit(async () => void journal.push('nested')));
      await afterCommit(() => Promise.reject(new Error('lost after the commit')));
      await afterCommit(async () => void journal.push('last'));
      journal.push('work done');
    });

    expect(journal).toEqual(['work done', 'first', 'nested', 'last']);
  });

  it('runs nothing of a unit of work that failed, and runs at once outside of any', async () => {
    const journal: string[] = [];

    await new InMemoryUnitOfWork()
      .run(async () => {
        await afterCommit(async () => void journal.push('never'));
        throw new Error('rolled back');
      })
      .catch(() => undefined);

    await afterCommit(async () => void journal.push('at once'));

    expect(journal).toEqual(['at once']);
  });
});
