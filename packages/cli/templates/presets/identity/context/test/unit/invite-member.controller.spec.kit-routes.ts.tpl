import { describe, expect, it } from '{{tests.module}}';
import { routeOf } from '@ddd-ts-kit/http/testing';
import type { Actor } from '@ddd-ts-kit/kernel';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
import { InviteMemberCommand } from '{{alias.context}}/application/commands/invite-member/invite-member.command{{alias.ext}}';
import { InviteMemberController } from '{{alias.context}}/presentation/http/organisations/invite-member/invite-member.controller{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('POST /organisations/:organisationId/invitations', () => {
  it('answers 201 with what the use case answered, and sends it what the request says', async () => {
    const { route, send, commands } = arrange();

    const response = await send({ params: { organisationId: 'acme' }, body: { email: 'grace@example.test', role: 'admin' } });

    expect(route.path).toBe('/organisations/:organisationId/invitations');
    expect([response.status, response.body]).toEqual([201, { id: 'invitation-1', token: 'token-1' }]);
    expect(commands.executed).toMatchObject([{ organisationId: 'acme', invitee: { email: 'grace@example.test', role: 'admin' } }]);
  });

  it('refuses with 422 a request its contract does not describe, and sends nothing', async () => {
    const { send, commands } = arrange();

    const response = await send({ params: { organisationId: 'acme' }, body: { email: 'grace@example.test', role: 'king' } });

    expect(response.status).toBe(422);
    expect(commands.executed).toEqual([]);
  });
});

/** The route, sent as `caller` unless a test names another, on a bus that keeps what it was sent and answers as the use case would. */
function arrange(as: Actor = caller) {
  const commands = new RecordingCommandBus().answering(InviteMemberCommand, () => ({
    id: 'invitation-1',
    token: 'token-1',
  }));

  return { ...routeOf(new InviteMemberController(commands), { caller: as }), commands };
}
