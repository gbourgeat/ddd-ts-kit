import { describe, expect, it } from 'vitest';
import {
  InMemoryDomainEventDispatcher,
  InMemoryUnitOfWork,
  SaveAfterCommitError,
  announceDomainEvents,
  unitOfWorkStage,
} from '../src';

/**
 * The guarantee the spec of every reaction of a project leans on, proven here once: a project
 * spec gives its reaction the fact and asserts what it sent, it never proves the phase again.
 */
describe('a reaction to an event announced inside a unit of work', () => {
  it('runs at its phase, before the commit or once committed, without failing', async () => {
    const dispatcher = new InMemoryDomainEventDispatcher();
    const opened = { name: 'shop.cart.opened', aggregateId: 'c1', occurredAt: new Date(0) };
    const reactedAt: string[] = [];

    dispatcher.on('shop.cart.opened', async () => void reactedAt.push(`before ${unitOfWorkStage()}`));

    dispatcher.on('shop.cart.opened', async () => void reactedAt.push(`after ${unitOfWorkStage()}`), {
      phase: 'after-commit',
    });

    await new InMemoryUnitOfWork().run(() => announceDomainEvents([opened], dispatcher));

    expect(reactedAt).toEqual(['before before-commit', 'after after-commit']);
    expect(dispatcher.afterCommitFailures).toEqual([]);
  });

  it('may not announce events of its own once committed: the unit of work is over', async () => {
    const dispatcher = new InMemoryDomainEventDispatcher();
    const opened = { name: 'shop.cart.opened', aggregateId: 'c1', occurredAt: new Date(0) };
    const closed = { name: 'shop.cart.closed', aggregateId: 'c1', occurredAt: new Date(0) };

    dispatcher.on('shop.cart.opened', () => announceDomainEvents([closed], dispatcher), { phase: 'after-commit' });

    await new InMemoryUnitOfWork().run(() => announceDomainEvents([opened], dispatcher));

    expect(dispatcher.afterCommitFailures.map(({ error }) => error)).toEqual([
      new SaveAfterCommitError('announceDomainEvents'),
    ]);
  });
});

describe('the failures of the after-commit phase, in the dispatcher in memory', () => {
  it('are kept a hundred at most, the oldest forgotten first, and told even to a reporter that fails itself', async () => {
    const dispatcher = new InMemoryDomainEventDispatcher(() => {
      throw new Error('the reporter is down');
    });

    const events = Array.from({ length: 101 }, (_, index) => ({
      name: 'shop.cart.opened',
      aggregateId: `c${String(index)}`,
      occurredAt: new Date(0),
    }));

    dispatcher.on('shop.cart.opened', () => Promise.reject(new Error('cache down')), { phase: 'after-commit' });

    await dispatcher.dispatch(events, 'after-commit');

    expect(dispatcher.afterCommitFailures).toHaveLength(100);
    expect(dispatcher.afterCommitFailures[0]?.event.aggregateId).toBe('c1');
    expect(dispatcher.afterCommitFailures.at(-1)?.event.aggregateId).toBe('c100');
  });
});
