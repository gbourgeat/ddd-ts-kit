import { describe, expect, it } from '{{tests.module}}';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
{{#if access.protected}}
import { anActor } from '@ddd-ts-kit/auth/testing';
{{/if}}
{{spec.diWithFake}}
{{spec.contextImports}}
import { platformTestModule } from '{{paths.integrationToPlatform}}/platform-test.module.js';
{{#if access.protected}}
import { {{context.camel}}Permissions } from '../../application/authorization/{{context.kebab}}.permissions.js';
{{/if}}
import { {{name.pascal}}Reader } from '../../application/ports/{{name.kebab}}-reader.port.js';
import { {{name.pascal}}Query } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import type { {{name.pascal}}Result } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.result.js';
import { Fake{{name.pascal}}Reader } from '../fakes/{{name.kebab}}-reader.fake.js';
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
