import { describe, expect, it } from '{{tests.module}}';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
import { ChangeMemberRoleController } from '{{alias.context}}/presentation/http/organisations/change-member-role/change-member-role.controller{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('PUT /organisations/:organisationId/members/:accountId/role', () => {
  it('answers 200 with what the use case answered, and sends it what the request says', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: { organisationId: 'acme', accountId: 'subject-grace' }, query: {}, headers: {}, body: { role: 'member' }, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(route.path).toBe('/organisations/:organisationId/members/:accountId/role');
    expect([response.status, response.body]).toEqual([200, { id: 'member-1' }]);
    expect(sent).toMatchObject([{ organisationId: 'acme', accountId: 'subject-grace', role: 'member' }]);
  });

  it('refuses with 422 a request its contract does not describe, and sends nothing', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: { organisationId: 'acme', accountId: 'subject-grace' }, query: {}, headers: {}, body: { role: 'emperor' }, raw: undefined },
      { resolvePrincipal: () => caller },
    );

    expect(response.status).toBe(422);
    expect(sent).toEqual([]);
  });
});

/** The route, on a bus that keeps what it was sent and answers as the use case would. */
function arrange() {
  const sent: ChangeMemberRoleCommand[] = [];

  const commands = new InMemoryCommandBus().register(ChangeMemberRoleCommand, {
    execute: async (command) => {
      sent.push(command);

      return 'member-1';
    },
  });

  return { route: controllerRoute(new ChangeMemberRoleController(commands)), sent };
}
