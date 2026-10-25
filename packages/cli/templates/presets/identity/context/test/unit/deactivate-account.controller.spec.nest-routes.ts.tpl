import { describe, expect, it } from '{{tests.module}}';
import { executeRoute } from '@ddd-ts-kit/http';
import { nestControllerRoute } from '@ddd-ts-kit/http/nest';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
import { DeactivateAccountController } from '{{alias.context}}/presentation/http/accounts/deactivate-account/deactivate-account.controller{{alias.ext}}';
import { {{context.camel}}Controllers } from '{{alias.context}}/{{context.kebab}}.controllers{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('POST /accounts/me/deactivation', () => {
  it('answers 200 with what the use case answered, and sends it what the request says', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: {}, query: {}, headers: {}, body: {}, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(route.path).toBe('/accounts/me/deactivation');
    expect([response.status, response.body]).toEqual([200, { id: 'subject-ada' }]);
    expect(sent).toMatchObject([{ actor: { id: 'subject-ada' } }]);
  });

  it('is listed in the Nest controllers of the context, which say what its signature takes and answers', () => {
    expect({{context.camel}}Controllers).toContain(DeactivateAccountController);
  });
});

/** The route, on a bus that keeps what it was sent and answers as the use case would. */
function arrange() {
  const sent: DeactivateAccountCommand[] = [];

  const commands = new InMemoryCommandBus().register(DeactivateAccountCommand, {
    execute: async (command) => {
      sent.push(command);

      return 'subject-ada';
    },
  });

  const route = nestControllerRoute(DeactivateAccountController, {
    instanceOf: () => new DeactivateAccountController(commands),
    // A DTO without a decorated field accepts the empty object alone: whitelist and forbidNonWhitelisted refuse any field.
    schemaOfClass: (dto) => classSchema(dto, { validator: { forbidUnknownValues: false } }),
  });

  return { route, sent };
}
