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
{{#if world.through}}
import { fake } from '@ddd-ts-kit/di';
{{/if}}
{{#unless world.through}}
{{spec.diWithFake}}
{{spec.contextImports}}
import { platformTestModule } from '{{alias.platform}}/composition/platform-test.module{{alias.ext}}';
{{/unless}}
{{#if access.protected}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}
import { {{name.pascal}}Reader } from '{{alias.context}}/application/ports/{{name.kebab}}-reader.port{{alias.ext}}';
import { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query{{alias.ext}}';
import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';
import { Fake{{name.pascal}}Reader } from '{{alias.context}}/test/fakes/{{name.kebab}}-reader.fake{{alias.ext}}';
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
  it('answers what the read model holds', async () => {
    const answer: {{name.pascal}}Result = {};
    const application = {{world.await}}arrange(answer);
    const query = new {{name.pascal}}Query({{access.holder}});

    expect(await application.queryBus.execute(query)).toEqual(answer);
  });
{{#if access.protected}}

  it('is refused to an actor who does not hold the permission {{access.permission}}', async () => {
    const application = {{world.await}}arrange({});
    const query = new {{name.pascal}}Query(anActor().build());

    await expect(application.queryBus.execute(query)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
{{/if}}

  // TODO(domain): replace each entry below by a test named after what "{{name.words}}" shows and to whom.
  it.todo('answers only what the asker is allowed to see');
  it.todo('applies each criterion of the query');
});

{{#if world.through}}
async function arrange(answer: {{name.pascal}}Result) {
  const { application } = await {{world.builder}}({{world.options}});

  return application;
}
{{/if}}
{{#unless world.through}}
{{world.comment}}
{{spec.async}}function arrange(answer: {{name.pascal}}Result) {
{{#if spec.assembles}}
  const context = {{spec.context}};

{{/if}}
  return createTestApplication({
    modules: [{{spec.modules}}],
    fakes: [fake({{name.pascal}}Reader, new Fake{{name.pascal}}Reader(answer))],
  });
}
{{/unless}}
