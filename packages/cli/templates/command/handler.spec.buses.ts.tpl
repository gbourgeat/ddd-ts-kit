import { describe, expect, it } from '{{tests.module}}';
{{#if access.protected}}
import { AuthorizationMap, RoleBasedAuthorizer, authorizationMiddleware, requires } from '@ddd-ts-kit/auth';
import { anActor } from '@ddd-ts-kit/auth/testing';
{{/if}}
import { createTestBuses } from '@ddd-ts-kit/testing';
{{#if access.protected}}
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions.js';
{{/if}}
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command.js';
import { {{name.pascal}}Handler } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.handler.js';
{{#if command.hasAggregate}}
import { Fake{{aggregate.pascal}}Repository } from '{{alias.context}}/test/fakes/{{aggregate.kebab}}.repository.fake.js';
{{/if}}
{{#if access.protected}}

const holders = authorizationMiddleware({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] },
  }),
  map: AuthorizationMap.of(requires({{name.pascal}}Command, {{context.camel}}Permissions['{{access.permission}}'])),
});

const holder = anActor().withRole('holder').build();
{{/if}}

describe('{{name.title}}', () => {
  {{#if command.hasAggregate}}
  it('saves the {{aggregate.words}} and answers its identifier', async () => {
    const { commandBus, {{aggregate.camel}}Repository } = arrange();

    const id = await commandBus.execute(new {{name.pascal}}Command({{access.holder}}));

    expect(id).toBe('{{aggregate.kebab}}-1');
    expect(await {{aggregate.camel}}Repository.findById(id)).toBeDefined();
  });
  {{/if}}
  {{#unless command.hasAggregate}}
  it('completes without answering anything', async () => {
    const { commandBus } = arrange();
    const command = new {{name.pascal}}Command({{access.holder}});

    await expect(commandBus.execute(command)).resolves.toBeUndefined();
  });
  {{/unless}}
  {{#if access.protected}}

  it('is refused to an actor who does not hold the permission {{access.permission}}', async () => {
    const { commandBus } = arrange();
    const command = new {{name.pascal}}Command(anActor().build());

    await expect(commandBus.execute(command)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  {{/if}}

  {{#if command.hasAggregate}}
  // TODO(domain): replace each entry below by a test named after the business behaviour of "{{name.words}}": arrange with the builders of test/builders and the fakes, execute through the bus, assert the stored {{aggregate.words}}, the facts announced with the save (`domainEvents.on('<name>', ...)` registered in `arrange`) and the answer.
  it.todo('applies the business decision to the {{aggregate.words}}');
  {{/if}}
  {{#unless command.hasAggregate}}
  // TODO(domain): replace each entry below by a test named after the business behaviour of "{{name.words}}": arrange with builders and fakes of its ports, execute through the bus, assert the outcome.
  it.todo('applies the business decision to the aggregate');
  {{/unless}}
  it.todo('refuses the command when a business rule is violated, with the expected error code');
  it.todo('saves and publishes nothing when the command is refused');
});

function arrange() {
  {{#if command.hasAggregate}}
  const { commandBus, clock, ids, dispatching, domainEvents } = createTestBuses({ idPrefix: '{{aggregate.kebab}}' });
  // As the application hands it to the handler: the save announces the events of the {{aggregate.words}} to `domainEvents`.
  const {{aggregate.camel}}Repository = dispatching(new Fake{{aggregate.pascal}}Repository());

  const handler = new {{name.pascal}}Handler({{aggregate.camel}}Repository, ids, clock);

  commandBus{{spec.guard}}.register({{name.pascal}}Command, handler);

  return { commandBus, {{aggregate.camel}}Repository, domainEvents };
  {{/if}}
  {{#unless command.hasAggregate}}
  const { commandBus } = createTestBuses();

  commandBus{{spec.guard}}.register({{name.pascal}}Command, new {{name.pascal}}Handler());

  return { commandBus };
  {{/unless}}
}
