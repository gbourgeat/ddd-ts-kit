import { describe, expect, it } from '{{tests.module}}';
{{#if access.protected}}
import { AuthorizationMap, RoleBasedAuthorizer, authorizationMiddleware, requires } from '@ddd-ts-kit/auth';
import { anActor } from '@ddd-ts-kit/auth/testing';
{{/if}}
import { createTestBuses } from '@ddd-ts-kit/testing';
{{#if access.protected}}
import { {{context.camel}}Permissions } from '../../application/authorization/{{context.kebab}}.permissions.js';
{{/if}}
import { {{name.pascal}}Handler } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.handler.js';
import { {{name.pascal}}Query } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import type { {{name.pascal}}Result } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.result.js';
import { Fake{{name.pascal}}Reader } from '../fakes/{{name.kebab}}-reader.fake.js';
{{#if access.protected}}

const holders = authorizationMiddleware({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] },
  }),
  map: AuthorizationMap.of(requires({{name.pascal}}Query, {{context.camel}}Permissions['{{access.permission}}'])),
});

const holder = anActor().withRole('holder').build();
{{/if}}

describe('{{name.title}}', () => {
  it('answers what the read model holds', async () => {
    const answer: {{name.pascal}}Result = {};
    const queryBus = arrange(answer);
    const query = new {{name.pascal}}Query({{access.holder}});

    expect(await queryBus.execute(query)).toEqual(answer);
  });
  {{#if access.protected}}

  it('is refused to an actor who does not hold the permission {{access.permission}}', async () => {
    const queryBus = arrange({});
    const query = new {{name.pascal}}Query(anActor().build());

    await expect(queryBus.execute(query)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  {{/if}}

  // TODO(domain): replace each entry below by a test named after what "{{name.words}}" shows and to whom.
  it.todo('answers only what the asker is allowed to see');
  it.todo('applies each criterion of the query');
});

function arrange(answer: {{name.pascal}}Result) {
  const { queryBus } = createTestBuses();
  const handler = new {{name.pascal}}Handler(new Fake{{name.pascal}}Reader(answer));

  return queryBus{{spec.guard}}.register({{name.pascal}}Query, handler);
}
