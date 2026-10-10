import { describe, expect, it } from '{{tests.module}}';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
{{spec.diWithFake}}
{{spec.contextImports}}
import { offsetPage } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '{{paths.integrationToPlatform}}/platform-test.module.js';
{{#if access.protected}}
import { {{context.camel}}Permissions } from '../../application/authorization/{{context.kebab}}.permissions.js';
{{/if}}
import { {{name.pascal}}Reader } from '../../application/ports/{{name.kebab}}-reader.port.js';
import { {{name.pascal}}Query } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import type { {{name.pascal}}Item } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.result.js';
import { Fake{{name.pascal}}Reader } from '../fakes/{{name.kebab}}-reader.fake.js';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] },
  }),
});

const holder = anActor().withRole('holder').build();
const LISTED = ['{{list.resource}}-1', '{{list.resource}}-2', '{{list.resource}}-3'];
const LINES: readonly {{name.pascal}}Item[] = LISTED.map((id) => ({ id }));

describe('{{name.title}}', () => {
  it('answers one page of what the actor may see, with the total', async () => {
    const application = {{spec.await}}arrange(LINES);
    const query = new {{name.pascal}}Query(holder, offsetPage({ limit: 2 }));

    const page = await application.queryBus.execute(query);

    expect(page).toEqual({ items: LINES.slice(0, 2), total: 3 });
  });

  it('is refused to an actor who does not hold the permission {{access.permission}}', async () => {
    const application = {{spec.await}}arrange(LINES);
    const query = new {{name.pascal}}Query(anActor().build(), offsetPage());

    await expect(application.queryBus.execute(query)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // TODO(domain): replace each entry below by a test named after what "{{name.words}}" shows and to whom.
  it.todo('lists only what the access scope of the actor covers');
  it.todo('applies each criterion of the query');
});

{{spec.async}}function arrange(lines: readonly {{name.pascal}}Item[]) {
{{#if spec.assembles}}
  const context = {{spec.context}};

{{/if}}
  return createTestApplication({
    modules: [{{spec.modules}}],
    fakes: [fake({{name.pascal}}Reader, new Fake{{name.pascal}}Reader(lines))],
  });
}
