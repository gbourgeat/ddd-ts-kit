import { describe, expect, it } from '{{tests.module}}';
import { nestControllerRoute } from '@ddd-ts-kit/http/nest';
import { routeOf } from '@ddd-ts-kit/http/testing';
import type { Actor } from '@ddd-ts-kit/kernel';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
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
    const { route, send, commands } = arrange();

    const response = await send({ body: { displayName: 'Ada L.' } });

    expect(route.path).toBe('/accounts/me');
    expect([response.status, response.body]).toEqual([200, { id: 'subject-ada' }]);

    expect(commands.executed).toMatchObject([
      { actor: { id: 'subject-ada' }, profile: { email: 'ada@example.test', emailVerified: true, displayName: 'Ada L.' } },
    ]);
  });

  it('says the address is not verified unless the token says it is', async () => {
    const unverified: Actor = { ...caller, attributes: { email: 'ada@example.test' } };
    const { send, commands } = arrange(unverified);

    await send({ body: {} });

    expect(commands.executed).toMatchObject([{ profile: { email: 'ada@example.test', emailVerified: false, displayName: 'ada@example.test' } }]);
  });

  it('names the person after their username when the body names nothing, and sends no address the token lacks', async () => {
    const withoutAddress: Actor = { ...caller, attributes: { username: 'ada' } };
    const { send, commands } = arrange(withoutAddress);

    await send({ body: {} });

    expect(commands.executed).toMatchObject([{ profile: { email: '', emailVerified: false, displayName: 'ada' } }]);
  });

  it('refuses with 422 a request its contract does not describe, and sends nothing', async () => {
    const { send, commands } = arrange();

    const response = await send({ body: { displayName: '' } });

    expect(response.status).toBe(422);
    expect(commands.executed).toEqual([]);
  });

  it('is listed in the Nest controllers of the context, which say what its signature takes and answers', () => {
    expect({{context.camel}}Controllers).toContain(ProvisionAccountController);
  });
});

/** The route, sent as `caller` unless a test names another, on a bus that keeps what it was sent and answers as the use case would. */
function arrange(as: Actor = caller) {
  const commands = new RecordingCommandBus().answering(ProvisionAccountCommand, () => 'subject-ada');

  const route = nestControllerRoute(ProvisionAccountController, {
    instanceOf: () => new ProvisionAccountController(commands),
    // A DTO without a decorated field accepts the empty object alone: whitelist and forbidNonWhitelisted refuse any field.
    schemaOfClass: (dto) => classSchema(dto, { validator: { forbidUnknownValues: false } }),
  });

  return { ...routeOf(route, { caller: as }), commands };
}
