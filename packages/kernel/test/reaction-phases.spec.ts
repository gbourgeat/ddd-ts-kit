import { describe, expect, it } from 'vitest';
import { InMemoryDomainEventDispatcher, InMemoryUnitOfWork, announceDomainEvents, unitOfWorkStage } from '../src';

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
});
