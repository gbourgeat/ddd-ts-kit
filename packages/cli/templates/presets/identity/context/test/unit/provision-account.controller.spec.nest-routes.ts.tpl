import { describe, expect, it } from '{{tests.module}}';
import { executeRoute } from '@ddd-ts-kit/http';
import { nestControllerRoute } from '@ddd-ts-kit/http/nest';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { ProvisionAccountCommand } from '{{alias.context}}/application/commands/provision-account/provision-account.command{{alias.ext}}';
import { ProvisionAccountController } from '{{alias.context}}/presentation/http/accounts/provision-account/provision-account.controller{{alias.ext}}';
import { {{context.camel}}Controllers } from '{{alias.context}}/{{context.kebab}}.controllers{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', emailVerified: true, username: 'ada' },
};

describe('PUT /accounts/me', () => {
  it('answers 200 with what the use case answered, and sends it what the request says', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: { displayName: 'Ada L.' }, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(route.path).toBe('/accounts/me');
    expect([response.status, response.body]).toEqual([200, { id: 'subject-ada' }]);

    expect(sent).toMatchObject([
      { actor: { id: 'subject-ada' }, profile: { email: 'ada@example.test', emailVerified: true, displayName: 'Ada L.' } },
    ]);
  });

  it('says the address is not verified unless the token says it is', async () => {
    const { route, sent } = arrange();
    const unverified: Actor = { ...caller, attributes: { email: 'ada@example.test' } };

    await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: {}, raw: undefined },
      { resolvePrincipal: () => unverified },
    );

    expect(sent).toMatchObject([{ profile: { email: 'ada@example.test', emailVerified: false, displayName: 'ada@example.test' } }]);
  });

  it('names the person after their username when the body names nothing, and sends no address the token lacks', async () => {
    const { route, sent } = arrange();
    const withoutAddress: Actor = { ...caller, attributes: { username: 'ada' } };

    await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: {}, raw: undefined },
      { resolvePrincipal: () => withoutAddress },
    );

    expect(sent).toMatchObject([{ profile: { email: '', emailVerified: false, displayName: 'ada' } }]);
  });

  it('refuses with 422 a request its contract does not describe, and sends nothing', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: { displayName: '' }, raw: undefined },
      { resolvePrincipal: () => caller },
    );

    expect(response.status).toBe(422);
    expect(sent).toEqual([]);
  });

  it('is listed in the Nest controllers of the context, which say what its signature takes and answers', () => {
    expect({{context.camel}}Controllers).toContain(ProvisionAccountController);
  });
});

/** The route, on a bus that keeps what it was sent and answers as the use case would. */
function arrange() {
  const sent: ProvisionAccountCommand[] = [];

  const commands = new InMemoryCommandBus().register(ProvisionAccountCommand, {
    execute: async (command) => {
      sent.push(command);

      return 'subject-ada';
    },
  });

  const route = nestControllerRoute(ProvisionAccountController, {
    instanceOf: () => new ProvisionAccountController(commands),
    // A DTO without a decorated field accepts the empty object alone: whitelist and forbidNonWhitelisted refuse any field.
    schemaOfClass: (dto) => classSchema(dto, { validator: { forbidUnknownValues: false } }),
  });

  return { route, sent };
}
