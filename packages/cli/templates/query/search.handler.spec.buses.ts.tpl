import { describe, expect, it } from '{{tests.module}}';
import { AuthorizationMap, PolicyAccess, authorizationMiddleware, requires } from '@ddd-ts-kit/auth';
import { anActor, holdersOf } from '@ddd-ts-kit/auth/testing';
import { offsetPage } from '@ddd-ts-kit/kernel';
{{#unless world.through}}
import { createTestBuses } from '@ddd-ts-kit/testing';
{{/unless}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
import { {{name.pascal}}Handler } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.handler{{alias.ext}}';
import { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query{{alias.ext}}';
import type { {{name.pascal}}Item } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';
import { Fake{{name.pascal}}Reader } from '{{alias.context}}/test/fakes/{{name.kebab}}-reader.fake{{alias.ext}}';
{{#if world.through}}
{{world.import}}
{{/if}}

const { holder, authorizer } = holdersOf({{context.camel}}Permissions['{{access.permission}}']);

const holders = authorizationMiddleware({
  authorizer,
  map: AuthorizationMap.of(requires({{name.pascal}}Query, {{context.camel}}Permissions['{{access.permission}}'])),
});

const SEARCHED = ['{{search.resource}}-1', '{{search.resource}}-2', '{{search.resource}}-3'];
const LINES: readonly {{name.pascal}}Item[] = SEARCHED.map((id) => ({ id }));

describe('{{name.title}}', () => {
  it('answers one page of what the actor may see, with the total', async () => {
    const queryBus = {{world.await}}arrange(LINES);
    const query = new {{name.pascal}}Query(holder, offsetPage({ limit: 2 }));

    const page = await queryBus.execute(query);

    expect(page).toEqual({ items: LINES.slice(0, 2), total: 3 });
  });

  it('is refused to an actor who does not hold the permission {{access.permission}}', async () => {
    const queryBus = {{world.await}}arrange(LINES);
    const query = new {{name.pascal}}Query(anActor().build(), offsetPage());

    await expect(queryBus.execute(query)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // TODO(domain): replace each entry below by a test named after what "{{name.words}}" shows and to whom.
  it.todo('lists only what the access scope of the actor covers');
  it.todo('applies each criterion of the query');
});

{{#unless world.through}}
{{world.comment}}
{{/unless}}
{{world.async}}function arrange(lines: readonly {{name.pascal}}Item[]) {
{{#if world.through}}
  const { queryBus, clock } = await {{world.builder}}({{world.options}});
{{/if}}
{{#unless world.through}}
  const { queryBus, clock } = createTestBuses();
{{/unless}}
  const handler = new {{name.pascal}}Handler(new Fake{{name.pascal}}Reader(lines), new PolicyAccess({ authorizer, clock }));

  return queryBus.use(holders).register({{name.pascal}}Query, handler);
}
