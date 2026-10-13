import { describe, expect, it } from '{{tests.module}}';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
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
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: { slug: 'acme', name: 'Acme' }, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(route.path).toBe('/organisations');
    expect([response.status, response.body]).toEqual([201, { id: 'acme' }]);
    expect(sent).toMatchObject([{ organisation: { slug: 'acme', name: 'Acme' } }]);
  });

  it('refuses with 422 a request its contract does not describe, and sends nothing', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: { slug: 'acme' }, raw: undefined },
      { resolvePrincipal: () => caller },
    );

    expect(response.status).toBe(422);
    expect(sent).toEqual([]);
  });
});

/** The route, on a bus that keeps what it was sent and answers as the use case would. */
function arrange() {
  const sent: OpenOrganisationCommand[] = [];

  const commands = new InMemoryCommandBus().register(OpenOrganisationCommand, {
    execute: async (command) => {
      sent.push(command);

      return 'acme';
    },
  });

  return { route: controllerRoute(new OpenOrganisationController(commands)), sent };
}
