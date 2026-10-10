import { describe, expect, it } from '{{tests.module}}';
import {
  AuthorizationMap,
  PolicyAccess,
  RoleBasedAuthorizer,
  authorizationMiddleware,
  requires,
} from '@ddd-ts-kit/auth';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { FixedClock, offsetPage } from '@ddd-ts-kit/kernel';
import { createTestBuses } from '@ddd-ts-kit/testing';
import { {{context.camel}}Permissions } from '../../application/authorization/{{context.kebab}}.permissions.js';
import { {{name.pascal}}Handler } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.handler.js';
import { {{name.pascal}}Query } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import type { {{name.pascal}}Item } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.result.js';
import { Fake{{name.pascal}}Reader } from '../fakes/{{name.kebab}}-reader.fake.js';

const authorizer = new RoleBasedAuthorizer({
  roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] },
});

const holders = authorizationMiddleware({
  authorizer,
  map: AuthorizationMap.of(requires({{name.pascal}}Query, {{context.camel}}Permissions['{{access.permission}}'])),
});

const holder = anActor().withRole('holder').build();
const LISTED = ['{{list.resource}}-1', '{{list.resource}}-2', '{{list.resource}}-3'];
const LINES: readonly {{name.pascal}}Item[] = LISTED.map((id) => ({ id }));

describe('{{name.title}}', () => {
  it('answers one page of what the actor may see, with the total', async () => {
    const queryBus = arrange(LINES);
    const query = new {{name.pascal}}Query(holder, offsetPage({ limit: 2 }));

    const page = await queryBus.execute(query);

    expect(page).toEqual({ items: LINES.slice(0, 2), total: 3 });
  });

  it('is refused to an actor who does not hold the permission {{access.permission}}', async () => {
    const queryBus = arrange(LINES);
    const query = new {{name.pascal}}Query(anActor().build(), offsetPage());

    await expect(queryBus.execute(query)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // TODO(domain): replace each entry below by a test named after what "{{name.words}}" shows and to whom.
  it.todo('lists only what the access scope of the actor covers');
  it.todo('applies each criterion of the query');
});

function arrange(lines: readonly {{name.pascal}}Item[]) {
  const { queryBus } = createTestBuses();
  const access = new PolicyAccess({ authorizer, clock: new FixedClock(new Date('2026-01-01T00:00:00.000Z')) });
  const handler = new {{name.pascal}}Handler(new Fake{{name.pascal}}Reader(lines), access);

  return queryBus.use(holders).register({{name.pascal}}Query, handler);
}
