{{#if command.hasAggregate}}
import { describe, expect, it } from '{{tests.module}}';
import { InMemoryDomainEventDispatcher } from '@ddd-ts-kit/kernel';
import { createTestBuses } from '@ddd-ts-kit/testing';
import { {{name.pascal}}Command } from '../../application/commands/{{name.kebab}}/{{name.kebab}}.command.js';
import { {{name.pascal}}Handler } from '../../application/commands/{{name.kebab}}/{{name.kebab}}.handler.js';
import { Fake{{aggregate.pascal}}Repository } from '../fakes/{{aggregate.kebab}}.repository.fake.js';

describe('{{name.title}}', () => {
  it('saves the {{aggregate.words}} and answers its identifier', async () => {
    const { commandBus, {{aggregate.camel}}Repository } = arrange();

    const id = await commandBus.execute(new {{name.pascal}}Command());

    expect(id).toBe('{{aggregate.kebab}}-1');
    expect(await {{aggregate.camel}}Repository.findById(id)).toBeDefined();
  });

  // TODO(domain): replace each entry below by a test named after the business behaviour of "{{name.words}}": arrange with the builders of test/builders and the fakes, execute through the bus, assert the stored {{aggregate.words}}, the published events and the answer.
  it.todo('applies the business decision to the {{aggregate.words}}');
  it.todo('refuses the command when a business rule is violated, with the expected error code');
  it.todo('saves and publishes nothing when the command is refused');
});

function arrange() {
  const { commandBus, clock, ids } = createTestBuses({ idPrefix: '{{aggregate.kebab}}' });
  const {{aggregate.camel}}Repository = new Fake{{aggregate.pascal}}Repository();
  commandBus.register({{name.pascal}}Command, new {{name.pascal}}Handler({{aggregate.camel}}Repository, new InMemoryDomainEventDispatcher(), ids, clock));
  return { commandBus, {{aggregate.camel}}Repository };
}
{{/if}}
{{#unless command.hasAggregate}}
import { describe, expect, it } from '{{tests.module}}';
import { createTestBuses } from '@ddd-ts-kit/testing';
import { {{name.pascal}}Command } from '../../application/commands/{{name.kebab}}/{{name.kebab}}.command.js';
import { {{name.pascal}}Handler } from '../../application/commands/{{name.kebab}}/{{name.kebab}}.handler.js';

describe('{{name.title}}', () => {
  it('completes without answering anything', async () => {
    const { commandBus } = createTestBuses();
    commandBus.register({{name.pascal}}Command, new {{name.pascal}}Handler());

    await expect(commandBus.execute(new {{name.pascal}}Command())).resolves.toBeUndefined();
  });

  // TODO(domain): replace each entry below by a test named after the business behaviour of "{{name.words}}": arrange with builders and fakes of its ports, execute through the bus, assert the outcome.
  it.todo('applies the business decision to the aggregate');
  it.todo('refuses the command when a business rule is violated, with the expected error code');
  it.todo('saves and publishes nothing when the command is refused');
});
{{/unless}}
