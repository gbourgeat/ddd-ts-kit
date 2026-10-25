import { describe, expect, it } from '{{tests.module}}';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
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
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: { organisationId: 'acme' }, query: {}, headers: {}, body: { email: 'grace@example.test', role: 'admin' }, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(route.path).toBe('/organisations/:organisationId/invitations');
    expect([response.status, response.body]).toEqual([201, { id: 'invitation-1', token: 'token-1' }]);
    expect(sent).toMatchObject([{ organisationId: 'acme', invitee: { email: 'grace@example.test', role: 'admin' } }]);
  });

  it('refuses with 422 a request its contract does not describe, and sends nothing', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: { organisationId: 'acme' }, query: {}, headers: {}, body: { email: 'grace@example.test', role: 'king' }, raw: undefined },
      { resolvePrincipal: () => caller },
    );

    expect(response.status).toBe(422);
    expect(sent).toEqual([]);
  });
});

/** The route, on a bus that keeps what it was sent and answers as the use case would. */
function arrange() {
  const sent: InviteMemberCommand[] = [];

  const commands = new InMemoryCommandBus().register(InviteMemberCommand, {
    execute: async (command) => {
      sent.push(command);

      return { id: 'invitation-1', token: 'token-1' };
    },
  });

  return { route: controllerRoute(new InviteMemberController(commands)), sent };
}
