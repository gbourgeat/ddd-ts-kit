import { describe, expect, it } from '{{tests.module}}';
{{#unless world.through}}
{{#if access.public}}
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
{{/if}}
{{/unless}}
{{#if access.protected}}
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor, holdersOf } from '@ddd-ts-kit/auth/testing';
{{/if}}
{{#unless world.through}}
{{#if command.hasAggregate}}
{{spec.diWithFake}}
{{/if}}
{{#unless command.hasAggregate}}
{{spec.diPlain}}
{{/unless}}
{{spec.contextImports}}
import { platformTestModule } from '{{alias.platform}}/composition/platform-test.module{{alias.ext}}';
{{/unless}}
{{#if access.protected}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';
{{#unless world.through}}
{{#if command.hasAggregate}}
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
import { Fake{{aggregate.pascal}}Repository } from '{{alias.context}}/test/fakes/{{aggregate.kebab}}.repository.fake{{alias.ext}}';
{{/if}}
{{/unless}}
{{#if world.through}}
{{world.import}}
{{/if}}
{{#if access.protected}}

const { holder, authorizer } = holdersOf({{context.camel}}Permissions['{{access.permission}}']);
const holders = authorizationModule({ authorizer });
{{/if}}
{{#unless world.through}}
{{#if access.public}}

const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });
{{/if}}
{{/unless}}

describe('{{name.title}}', () => {
{{#if command.births}}
  it('saves the {{aggregate.words}} and answers its identifier', async () => {
    const { application, {{aggregate.camel}}Repository } = {{world.await}}arrange();

    const id = await application.commandBus.execute(new {{name.pascal}}Command({{access.holder}}));

    expect(id).toBe('{{aggregate.kebab}}-1');
    expect(await {{aggregate.camel}}Repository.findById(id)).toBeDefined();
  });
{{/if}}
{{#unless command.births}}
  it('completes without answering anything', async () => {
    const { application } = {{world.await}}arrange();
    const command = new {{name.pascal}}Command({{access.holder}});

    await expect(application.commandBus.execute(command)).resolves.toBeUndefined();
  });
{{/unless}}
{{#if access.protected}}

  it('is refused to an actor who does not hold the permission {{access.permission}}', async () => {
    const { application } = {{world.await}}arrange();
    const command = new {{name.pascal}}Command(anActor().build());

    await expect(application.commandBus.execute(command)).rejects.toMatchObject({ code: 'FORBIDDEN' });
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

{{#if world.through}}
async function arrange() {
  return {{world.builder}}({{world.options}});
}
{{/if}}
{{#unless world.through}}
{{world.comment}}
{{spec.async}}function arrange() {
{{#if spec.assembles}}
  const context = {{spec.context}};

{{/if}}
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
  const application = createTestApplication({
    modules: [{{spec.modules}}],
  });

  return { application };
{{/unless}}
}
{{/unless}}
