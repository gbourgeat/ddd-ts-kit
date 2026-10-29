import { describe, expect, it } from '{{tests.module}}';
import { nestControllerRoute } from '@ddd-ts-kit/http/nest';
import { routeOf } from '@ddd-ts-kit/http/testing';
import type { Actor } from '@ddd-ts-kit/kernel';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { RevokeDelegationCommand } from '{{alias.context}}/application/commands/revoke-delegation/revoke-delegation.command{{alias.ext}}';
import { RevokeDelegationController } from '{{alias.context}}/presentation/http/organisations/revoke-delegation/revoke-delegation.controller{{alias.ext}}';
import { {{context.camel}}Controllers } from '{{alias.context}}/{{context.kebab}}.controllers{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('DELETE /organisations/:organisationId/delegations/:delegationId', () => {
  it('answers 200 with what the use case answered, and sends it what the request says', async () => {
    const { route, send, commands } = arrange();

    const response = await send({ params: { organisationId: 'acme', delegationId: 'delegation-1' }, body: {} });

    expect(route.path).toBe('/organisations/:organisationId/delegations/:delegationId');
    expect([response.status, response.body]).toEqual([200, { id: 'delegation-1' }]);
    expect(commands.executed).toMatchObject([{ organisationId: 'acme', delegationId: 'delegation-1' }]);
  });

  it('is listed in the Nest controllers of the context, which say what its signature takes and answers', () => {
    expect({{context.camel}}Controllers).toContain(RevokeDelegationController);
  });
});

/** The route, sent as `caller` unless a test names another, on a bus that keeps what it was sent and answers as the use case would. */
function arrange(as: Actor = caller) {
  const commands = new RecordingCommandBus().answering(RevokeDelegationCommand, () => 'delegation-1');

  const route = nestControllerRoute(RevokeDelegationController, {
    instanceOf: () => new RevokeDelegationController(commands),
    // A DTO without a decorated field accepts the empty object alone: whitelist and forbidNonWhitelisted refuse any field.
    schemaOfClass: (dto) => classSchema(dto, { validator: { forbidUnknownValues: false } }),
  });

  return { ...routeOf(route, { caller: as }), commands };
}
