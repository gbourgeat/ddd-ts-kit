import { describe, expect, it } from 'vitest';
import { InMemoryUnitOfWork, afterCommit, atCommit, withinUnitOfWork, type CommitStep } from '../src/index.js';

function journaled(journal: string[], name: string, fails = false): CommitStep {
  return {
    apply: async () => {
      journal.push(`apply ${name}`);

      if (fails) {
        throw new Error(`${name} failed`);
      }
    },
    undo: async () => void journal.push(`undo ${name}`),
  };
}

describe('atCommit', () => {
  it('applies its steps last, inside the unit of work, in the order given, a nested one included', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const journal: string[] = [];

    await unitOfWork.run(async () => {
      await atCommit(journaled(journal, 'first'));
      await unitOfWork.run(() => atCommit(journaled(journal, 'nested')));
      await afterCommit(async () => void journal.push('after the commit'));
      journal.push('work done');
    });

    expect(journal).toEqual(['work done', 'apply first', 'apply nested', 'after the commit']);
  });

  it('rolls back on a step that fails, and undoes those applied, newest first', async () => {
    const journal: string[] = [];

    const failure = new InMemoryUnitOfWork().run(async () => {
      await atCommit(journaled(journal, 'first'));
      await atCommit(journaled(journal, 'second'));
      await atCommit(journaled(journal, 'third', true));
      await afterCommit(async () => void journal.push('never'));
    });

    await expect(failure).rejects.toThrow('third failed');
    expect(journal).toEqual(['apply first', 'apply second', 'apply third', 'undo second', 'undo first']);
  });

  it('applies nothing of a unit of work whose work failed, and applies at once outside of any', async () => {
    const journal: string[] = [];

    await new InMemoryUnitOfWork()
      .run(async () => {
        await atCommit(journaled(journal, 'never'));
        throw new Error('rolled back');
      })
      .catch(() => undefined);

    await atCommit(journaled(journal, 'at once'));

    expect(journal).toEqual(['apply at once']);
  });

  it('undoes the applied steps when the commit itself fails', async () => {
    const journal: string[] = [];

    const commitRefused = async (scoped: () => Promise<void>) => {
      await scoped();
      throw new Error('commit refused');
    };

    const failure = withinUnitOfWork(() => atCommit(journaled(journal, 'move')), commitRefused);

    await expect(failure).rejects.toThrow('commit refused');
    expect(journal).toEqual(['apply move', 'undo move']);
  });
});
