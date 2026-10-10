import { describe, expect, it } from '{{tests.module}}';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
{{#if access.protected}}
import { anActor } from '@ddd-ts-kit/auth/testing';
{{/if}}
{{#if command.hasAggregate}}
{{spec.diWithFake}}
{{/if}}
{{#unless command.hasAggregate}}
{{spec.diPlain}}
{{/unless}}
{{spec.contextImports}}
import { platformTestModule } from '{{paths.integrationToPlatform}}/platform-test.module.js';
{{#if access.protected}}
import { {{context.camel}}Permissions } from '../../application/authorization/{{context.kebab}}.permissions.js';
{{/if}}
import { {{name.pascal}}Command } from '../../application/commands/{{name.kebab}}/{{name.kebab}}.command.js';
{{#if command.hasAggregate}}
import { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
import { Fake{{aggregate.pascal}}Repository } from '../fakes/{{aggregate.kebab}}.repository.fake.js';
{{/if}}
{{#if access.protected}}

const holders = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] } }) });
const holder = anActor().withRole('holder').build();
{{/if}}
{{#if access.public}}

const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });
{{/if}}

describe('{{name.title}}', () => {
{{#if command.hasAggregate}}
  it('saves the {{aggregate.words}} and answers its identifier', async () => {
    const { application, {{aggregate.camel}}Repository } = {{spec.await}}arrange();

    const id = await application.commandBus.execute(new {{name.pascal}}Command({{access.holder}}));

    expect(id).toBe('{{aggregate.kebab}}-1');
    expect(await {{aggregate.camel}}Repository.findById(id)).toBeDefined();
  });
{{/if}}
{{#unless command.hasAggregate}}
  it('completes without answering anything', async () => {
    const { application } = {{spec.await}}arrange();

    await expect(application.commandBus.execute(new {{name.pascal}}Command({{access.holder}}))).resolves.toBeUndefined();
  });
{{/unless}}
{{#if access.protected}}

  it('is refused to an actor who does not hold the permission {{access.permission}}', async () => {
    const { application } = {{spec.await}}arrange();

    await expect(application.commandBus.execute(new {{name.pascal}}Command(anActor().build()))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
{{/if}}

{{#if command.hasAggregate}}
  // TODO(domain): replace each entry below by a test named after the business behaviour of "{{name.words}}": arrange with the builders of test/builders and the fakes, execute through the bus, assert the stored {{aggregate.words}}, the facts announced with the save (`application.domainEvents.on('<name>', ...)` before executing), `application.eventBus.published` and the answer.
  it.todo('applies the business decision to the {{aggregate.words}}');
{{/if}}
{{#unless command.hasAggregate}}
  // TODO(domain): replace each entry below by a test named after the business behaviour of "{{name.words}}": arrange with builders and fakes of its ports (`fakes: [fake(Port, aFake)]`), execute through the bus, assert the outcome.
  it.todo('applies the business decision to the aggregate');
{{/unless}}
  it.todo('refuses the command when a business rule is violated, with the expected error code');
  it.todo('saves and publishes nothing when the command is refused');
});

{{spec.async}}function arrange() {
{{#if command.hasAggregate}}
  const {{aggregate.camel}}Repository = new Fake{{aggregate.pascal}}Repository();

  const application = createTestApplication({
    modules: [{{spec.modules}}],
    fakes: [fake({{aggregate.pascal}}Repository, {{aggregate.camel}}Repository)],
    idPrefix: '{{aggregate.kebab}}',
  });

  return { application, {{aggregate.camel}}Repository };
{{/if}}
{{#unless command.hasAggregate}}
  return { application: createTestApplication({ modules: [{{spec.modules}}] }) };
{{/unless}}
}
