import { describe, expect, it } from '{{tests.module}}';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
{{spec.diWithFake}}
{{spec.contextImports}}
import { offsetPage } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '{{alias.platform}}/composition/platform-test.module{{alias.ext}}';
{{#if access.protected}}
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}
import { {{name.pascal}}Reader } from '{{alias.context}}/application/ports/{{name.kebab}}-reader.port{{alias.ext}}';
import { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query{{alias.ext}}';
import type { {{name.pascal}}Item } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';
import { Fake{{name.pascal}}Reader } from '{{alias.context}}/test/fakes/{{name.kebab}}-reader.fake{{alias.ext}}';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] },
  }),
});

const holder = anActor().withRole('holder').build();
const SEARCHED = ['{{search.resource}}-1', '{{search.resource}}-2', '{{search.resource}}-3'];
const LINES: readonly {{name.pascal}}Item[] = SEARCHED.map((id) => ({ id }));

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
