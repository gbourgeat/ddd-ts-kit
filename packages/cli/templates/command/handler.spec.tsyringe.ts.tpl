import { describe, expect, it } from '{{tests.module}}';
{{#if command.hasAggregate}}
import { createTestApplication, fake } from '@ddd-ts-kit/di';
{{/if}}
{{#unless command.hasAggregate}}
import { createTestApplication } from '@ddd-ts-kit/di';
{{/unless}}
import { platformTestModule } from '{{paths.integrationToPlatform}}/platform.module.js';
import { {{name.pascal}}Command } from '../../application/commands/{{name.kebab}}/{{name.kebab}}.command.js';
{{#if command.hasAggregate}}
import { {{aggregate.constant}}_REPOSITORY, {{context.camel}}Module } from '../../{{context.kebab}}.module.js';
import { Fake{{aggregate.pascal}}Repository } from '../fakes/{{aggregate.kebab}}.repository.fake.js';
{{/if}}
{{#unless command.hasAggregate}}
import { {{context.camel}}Module } from '../../{{context.kebab}}.module.js';
{{/unless}}

describe('{{name.title}}', () => {
{{#if command.hasAggregate}}
  it('saves the {{aggregate.words}} and answers its identifier', async () => {
    const { application, {{aggregate.camel}}Repository } = arrange();

    const id = await application.commandBus.execute(new {{name.pascal}}Command());

    expect(id).toBe('{{aggregate.kebab}}-1');
    expect(await {{aggregate.camel}}Repository.findById(id)).toBeDefined();
  });

  // TODO(domain): replace each entry below by a test named after the business behaviour of "{{name.words}}": arrange with the builders of test/builders and the fakes, execute through the bus, assert the stored {{aggregate.words}}, `application.eventBus.published` and the answer.
  it.todo('applies the business decision to the {{aggregate.words}}');
{{/if}}
{{#unless command.hasAggregate}}
  it('completes without answering anything', async () => {
    const application = createTestApplication({ modules: [platformTestModule, {{context.camel}}Module] });

    await expect(application.commandBus.execute(new {{name.pascal}}Command())).resolves.toBeUndefined();
  });

  // TODO(domain): replace each entry below by a test named after the business behaviour of "{{name.words}}": arrange with builders and fakes of its ports (`fakes: [fake(TOKEN, aFake)]`), execute through the bus, assert the outcome.
  it.todo('applies the business decision to the aggregate');
{{/unless}}
  it.todo('refuses the command when a business rule is violated, with the expected error code');
  it.todo('saves and publishes nothing when the command is refused');
});
{{#if command.hasAggregate}}

function arrange() {
  const {{aggregate.camel}}Repository = new Fake{{aggregate.pascal}}Repository();
  const application = createTestApplication({
    modules: [platformTestModule, {{context.camel}}Module],
    fakes: [fake({{aggregate.constant}}_REPOSITORY, {{aggregate.camel}}Repository)],
    idPrefix: '{{aggregate.kebab}}',
  });
  return { application, {{aggregate.camel}}Repository };
}
{{/if}}
