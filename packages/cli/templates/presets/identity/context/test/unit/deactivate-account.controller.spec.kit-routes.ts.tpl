import { describe, expect, it } from '{{tests.module}}';
import { routeOf } from '@ddd-ts-kit/http/testing';
import type { Actor } from '@ddd-ts-kit/kernel';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
import { DeactivateAccountController } from '{{alias.context}}/presentation/http/accounts/deactivate-account/deactivate-account.controller{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('POST /accounts/me/deactivation', () => {
  it('answers 200 with what the use case answered, and sends it what the request says', async () => {
    const { route, send, commands } = arrange();

    const response = await send({ body: {} });

    expect(route.path).toBe('/accounts/me/deactivation');
    expect([response.status, response.body]).toEqual([200, { id: 'subject-ada' }]);
    expect(commands.executed).toMatchObject([{ actor: { id: 'subject-ada' } }]);
  });
});

/** The route, sent as `caller` unless a test names another, on a bus that keeps what it was sent and answers as the use case would. */
function arrange(as: Actor = caller) {
  const commands = new RecordingCommandBus().answering(DeactivateAccountCommand, () => 'subject-ada');

  return { ...routeOf(new DeactivateAccountController(commands), { caller: as }), commands };
}
