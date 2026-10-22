import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unitOfWorkContract } from '../src/contracts';
import { CollectingRunner } from './support/collecting-runner';
import { TransactionalMemory } from './support/transactional-memory';

// The globals of the runner are passed as they are: the suites import no runner themselves.
const runner = { describe, it, expect, beforeEach, afterEach };

unitOfWorkContract(runner, {
  name: 'a unit of work built on withinUnitOfWork',
  createUnitOfWork: () => new TransactionalMemory(),
});

// A database of one connection: nothing outside the unit of work to look from.
unitOfWorkContract(runner, {
  name: 'a unit of work built on withinUnitOfWork, over a database of one connection',
  createUnitOfWork: () => {
    const memory = new TransactionalMemory();

    return {
      unitOfWork: memory.unitOfWork,
      outbox: memory.outbox,
      insert: (id) => memory.insert(id),
      insertRefusedAtCommit: (id) => memory.insertRefusedAtCommit(id),
      ids: () => memory.ids(),
    };
  },
});

describe('the unit of work contract and an adapter that forgot withinUnitOfWork', () => {
  it('fails it wherever the events would have left before the end or the handlers run before the commit', async () => {
    const collecting = new CollectingRunner();

    unitOfWorkContract(collecting, {
      name: 'forgetful',
      createUnitOfWork: () => new TransactionalMemory({ cooperating: false }),
    });

    const { failed, passed } = await collecting.run();

    expect(failed).toEqual([
      'dispatches nothing before the work returned: every handler sees every save',
      'dispatches what a handler saved after the events already waiting, once, in the same transaction',
      'joins the unit of work in progress on a nested run: one dispatch, at the end of the outermost',
      'runs no handler of the earlier saves when a later save is refused: nothing stored, nothing in the outbox',
      'runs no handler when the work fails after a save: nothing stored, nothing in the outbox',
      'drops the events of a rolled back unit of work: the retry dispatches what it records, once',
      'fails the unit of work when a before-commit handler fails: state and outbox rolled back, no after-commit handler',
      'rolls back what the before-commit handlers wrote when the commit itself fails, and runs no after-commit handler',
      'runs the after-commit handlers once the rows are committed, visible from outside the transaction',
      'reports the after-commit handler that fails, runs the others and answers the caller',
      'refuses the save of an after-commit handler before it writes, and runs the unit of work it opens apart',
    ]);

    expect(passed).toHaveLength(6);
  });
});
