import { describe, expect, it } from '{{tests.module}}';
import { routeOf } from '@ddd-ts-kit/http/testing';
import type { Actor } from '@ddd-ts-kit/kernel';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
import { OpenOrganisationCommand } from '{{alias.context}}/application/commands/open-organisation/open-organisation.command{{alias.ext}}';
import { OpenOrganisationController } from '{{alias.context}}/presentation/http/organisations/open-organisation/open-organisation.controller{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('POST /organisations', () => {
  it('answers 201 with what the use case answered, and sends it what the request says', async () => {
    const { route, send, commands } = arrange();

    const response = await send({ body: { slug: 'acme', name: 'Acme' } });

    expect(route.path).toBe('/organisations');
    expect([response.status, response.body]).toEqual([201, { id: 'acme' }]);
    expect(commands.executed).toMatchObject([{ organisation: { slug: 'acme', name: 'Acme' } }]);
  });

  it('refuses with 422 a request its contract does not describe, and sends nothing', async () => {
    const { send, commands } = arrange();

    const response = await send({ body: { slug: 'acme' } });

    expect(response.status).toBe(422);
    expect(commands.executed).toEqual([]);
  });
});

/** The route, sent as `caller` unless a test names another, on a bus that keeps what it was sent and answers as the use case would. */
function arrange(as: Actor = caller) {
  const commands = new RecordingCommandBus().answering(OpenOrganisationCommand, () => 'acme');

  return { ...routeOf(new OpenOrganisationController(commands), { caller: as }), commands };
}
