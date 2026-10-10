import { describe, expect, it } from '{{tests.module}}';
{{#if access.protected}}
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
{{/if}}
import { {{spec.di}}createTestApplication, fake } from '@ddd-ts-kit/di';
{{#if assembly.discovery}}
import { discoverContext } from '@ddd-ts-kit/di/discovery';
{{/if}}
import { platformTestModule } from '{{paths.integrationToPlatform}}/platform.module.js';
{{#if access.protected}}
import { {{context.camel}}Permissions } from '../../application/authorization/{{context.kebab}}.permissions.js';
{{/if}}
import { {{name.constant}}_READER } from '../../application/ports/{{context.kebab}}.ports.js';
import { {{name.pascal}}Query, type {{name.pascal}}Result } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
{{#if assembly.barrel}}
import * as {{context.camel}}Declarations from '../../{{context.kebab}}.declarations.js';
{{/if}}
import { Fake{{name.pascal}}Reader } from '../fakes/{{name.kebab}}-reader.fake.js';
{{#if access.protected}}

const holders = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] } }) });
const holder = anActor().withRole('holder').build();
{{/if}}

describe('{{name.title}}', () => {
  it('answers what the read model holds', async () => {
    const answer: {{name.pascal}}Result = {};
    const application = {{spec.await}}arrange(answer);

    expect(await application.queryBus.execute(new {{name.pascal}}Query({{access.holder}}))).toEqual(answer);
  });
{{#if access.protected}}

  it('is refused to an actor who does not hold the permission {{access.permission}}', async () => {
    const application = {{spec.await}}arrange({});

    await expect(application.queryBus.execute(new {{name.pascal}}Query(anActor().build()))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
{{/if}}

  // TODO(domain): replace each entry below by a test named after what "{{name.words}}" shows and to whom.
  it.todo('answers only what the asker is allowed to see');
  it.todo('applies each criterion of the query');
});

{{spec.async}}function arrange(answer: {{name.pascal}}Result) {
  return createTestApplication({
    modules: [{{spec.modules}}],
    fakes: [fake({{name.constant}}_READER, new Fake{{name.pascal}}Reader(answer))],
  });
}
