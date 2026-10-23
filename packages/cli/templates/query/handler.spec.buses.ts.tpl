import { describe, expect, it } from '{{tests.module}}';
{{#if access.protected}}
{{#if access.policy}}
import { AuthorizationMap, PolicyAccess, RoleBasedAuthorizer, authorizationMiddleware, requires } from '@ddd-ts-kit/auth';
{{/if}}
{{#unless access.policy}}
import { AuthorizationMap, RoleBasedAuthorizer, authorizationMiddleware, requires } from '@ddd-ts-kit/auth';
{{/unless}}
import { anActor } from '@ddd-ts-kit/auth/testing';
{{/if}}
import { createTestBuses } from '@ddd-ts-kit/testing';
{{#if access.protected}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}
import { {{name.pascal}}Handler } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.handler{{alias.ext}}';
import { {{name.pascal}}Query } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.query{{alias.ext}}';
import type { {{name.pascal}}Result } from '{{alias.context}}/application/queries/{{name.kebab}}/{{name.kebab}}.result{{alias.ext}}';
import { Fake{{name.pascal}}Reader } from '{{alias.context}}/test/fakes/{{name.kebab}}-reader.fake{{alias.ext}}';
{{#if access.protected}}

{{#if access.policy}}
const authorizer = new RoleBasedAuthorizer({ roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] } });

const holders = authorizationMiddleware({
  authorizer,
  map: AuthorizationMap.of(requires({{name.pascal}}Query, {{context.camel}}Permissions['{{access.permission}}'])),
});
{{/if}}
{{#unless access.policy}}
const holders = authorizationMiddleware({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] },
  }),
  map: AuthorizationMap.of(requires({{name.pascal}}Query, {{context.camel}}Permissions['{{access.permission}}'])),
});
{{/unless}}

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
{{#if access.policy}}
  const { queryBus, clock } = createTestBuses();
  const handler = new {{name.pascal}}Handler(new Fake{{name.pascal}}Reader(answer), new PolicyAccess({ authorizer, clock }));
{{/if}}
{{#unless access.policy}}
  const { queryBus } = createTestBuses();
  const handler = new {{name.pascal}}Handler(new Fake{{name.pascal}}Reader(answer));
{{/unless}}

  return queryBus{{spec.guard}}.register({{name.pascal}}Query, handler);
}
