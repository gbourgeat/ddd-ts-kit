import { describe, expect, it } from '{{tests.module}}';
import { routeOf } from '@ddd-ts-kit/http/testing';
import type { Actor } from '@ddd-ts-kit/kernel';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
import { AcceptInvitationCommand } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.command{{alias.ext}}';
import { AcceptInvitationController } from '{{alias.context}}/presentation/http/invitations/accept-invitation/accept-invitation.controller{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('POST /invitations/acceptance', () => {
  it('answers 200 with what the use case answered, and sends it what the request says', async () => {
    const { route, send, commands } = arrange();

    const response = await send({ body: { token: 'token-1' } });

    expect(route.path).toBe('/invitations/acceptance');
    expect([response.status, response.body]).toEqual([200, { id: 'invitation-1' }]);
    expect(commands.executed).toMatchObject([{ token: 'token-1' }]);
  });

  it('refuses with 422 a request its contract does not describe, and sends nothing', async () => {
    const { send, commands } = arrange();

    const response = await send({ body: {} });

    expect(response.status).toBe(422);
    expect(commands.executed).toEqual([]);
  });
});

/** The route, sent as `caller` unless a test names another, on a bus that keeps what it was sent and answers as the use case would. */
function arrange(as: Actor = caller) {
  const commands = new RecordingCommandBus().answering(AcceptInvitationCommand, () => 'invitation-1');

  return { ...routeOf(new AcceptInvitationController(commands), { caller: as }), commands };
}
