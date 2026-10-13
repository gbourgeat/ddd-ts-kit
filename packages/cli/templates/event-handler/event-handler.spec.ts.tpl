import { describe, expect, it } from '{{tests.module}}';
import {
  InMemoryDomainEventDispatcher,
  InMemoryUnitOfWork,
  announceDomainEvents,
  unitOfWorkStage,
} from '@ddd-ts-kit/kernel';
import { {{event.pascal}}EventHandler } from '{{alias.context}}/application/event-handlers/{{event.kebab}}.event-handler{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';

describe('When {{event.words}}', () => {
{{#unless handler.afterCommit}}
  it('reacts at the end of the unit of work, before the commit, without failing', async () => {
{{/unless}}
{{#if handler.afterCommit}}
  it('reacts once the unit of work has committed, without failing', async () => {
{{/if}}
    const handler = new {{event.pascal}}EventHandler();
    const event = new {{event.pascal}}('{{aggregate.kebab}}-1', new Date('2026-01-01T00:00:00.000Z'));
    const domainEvents = new InMemoryDomainEventDispatcher();
    const reactedAt: string[] = [];

    const asSubscribed = async (): Promise<void> => {
      await handler.handle(event);
      reactedAt.push(unitOfWorkStage());
    };

    domainEvents.on({{event.reference}}, asSubscribed, { phase: '{{handler.phase}}' });
    await new InMemoryUnitOfWork().run(() => announceDomainEvents([event], domainEvents));

    expect(reactedAt).toEqual(['{{handler.phase}}']);
    expect(domainEvents.afterCommitFailures).toEqual([]);
  });

  // TODO(domain): replace each entry below by a test named after the policy this reaction implements.
  it.todo('carries out the policy that follows the fact');
  it.todo('does nothing when the policy does not apply');
});
