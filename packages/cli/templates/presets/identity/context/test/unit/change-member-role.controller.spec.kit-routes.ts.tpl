import { describe, expect, it } from '{{tests.module}}';
import { routeOf } from '@ddd-ts-kit/http/testing';
import type { Actor } from '@ddd-ts-kit/kernel';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
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
    const { route, send, commands } = arrange();

    const response = await send({ params: { organisationId: 'acme', accountId: 'subject-grace' }, body: { role: 'member' } });

    expect(route.path).toBe('/organisations/:organisationId/members/:accountId/role');
    expect([response.status, response.body]).toEqual([200, { id: 'member-1' }]);
    expect(commands.executed).toMatchObject([{ organisationId: 'acme', accountId: 'subject-grace', role: 'member' }]);
  });

  it('refuses with 422 a request its contract does not describe, and sends nothing', async () => {
    const { send, commands } = arrange();

    const response = await send({ params: { organisationId: 'acme', accountId: 'subject-grace' }, body: { role: 'emperor' } });

    expect(response.status).toBe(422);
    expect(commands.executed).toEqual([]);
  });
});

/** The route, sent as `caller` unless a test names another, on a bus that keeps what it was sent and answers as the use case would. */
function arrange(as: Actor = caller) {
  const commands = new RecordingCommandBus().answering(ChangeMemberRoleCommand, () => 'member-1');

  return { ...routeOf(new ChangeMemberRoleController(commands), { caller: as }), commands };
}
