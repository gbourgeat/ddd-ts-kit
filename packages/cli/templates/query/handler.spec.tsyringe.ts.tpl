import { describe, expect, it } from '{{tests.module}}';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
{{#if access.protected}}
import { anActor } from '@ddd-ts-kit/auth/testing';
{{/if}}
{{spec.diWithFake}}
{{spec.contextImports}}
import { platformTestModule } from '{{alias.platform}}/platform-test.module{{alias.ext}}';
{{#if access.protected}}
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}
import { {{name.pascal}}Reader } from '{{alias.context}}/application/ports/{{name.kebab}}-reader.port{{alias.ext}}';
import { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query{{alias.ext}}';
import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';
import { Fake{{name.pascal}}Reader } from '{{alias.context}}/test/fakes/{{name.kebab}}-reader.fake{{alias.ext}}';
{{#if access.protected}}

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] },
  }),
});

const holder = anActor().withRole('holder').build();
{{/if}}
{{#if access.public}}

const authorization = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });
{{/if}}

describe('{{name.title}}', () => {
  it('answers what the read model holds', async () => {
    const answer: {{name.pascal}}Result = {};
    const application = {{spec.await}}arrange(answer);
    const query = new {{name.pascal}}Query({{access.holder}});

    expect(await application.queryBus.execute(query)).toEqual(answer);
  });
{{#if access.protected}}

  it('is refused to an actor who does not hold the permission {{access.permission}}', async () => {
    const application = {{spec.await}}arrange({});
    const query = new {{name.pascal}}Query(anActor().build());

    await expect(application.queryBus.execute(query)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
{{/if}}

  // TODO(domain): replace each entry below by a test named after what "{{name.words}}" shows and to whom.
  it.todo('answers only what the asker is allowed to see');
  it.todo('applies each criterion of the query');
});

{{spec.async}}function arrange(answer: {{name.pascal}}Result) {
{{#if spec.assembles}}
  const context = {{spec.context}};

{{/if}}
  return createTestApplication({
    modules: [{{spec.modules}}],
    fakes: [fake({{name.pascal}}Reader, new Fake{{name.pascal}}Reader(answer))],
  });
}
