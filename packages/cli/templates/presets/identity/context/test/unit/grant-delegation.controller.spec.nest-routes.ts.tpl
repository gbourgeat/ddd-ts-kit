import { describe, expect, it } from '{{tests.module}}';
import { executeRoute } from '@ddd-ts-kit/http';
import { nestControllerRoute } from '@ddd-ts-kit/http/nest';
import { InMemoryCommandBus, type Actor } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GrantDelegationCommand } from '{{alias.context}}/application/commands/grant-delegation/grant-delegation.command{{alias.ext}}';
import { GrantDelegationController } from '{{alias.context}}/presentation/http/organisations/grant-delegation/grant-delegation.controller{{alias.ext}}';
import { {{context.camel}}Controllers } from '{{alias.context}}/{{context.kebab}}.controllers{{alias.ext}}';

/** Who calls, as the authenticator of the platform makes them from the token. */
const caller: Actor = {
  id: 'subject-ada',
  type: 'user',
  roles: [],
  attributes: { email: 'ada@example.test', username: 'ada' },
};

describe('POST /organisations/:organisationId/delegations', () => {
  it('answers 201 with what the use case answered, and sends it what the request says', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: { organisationId: 'acme' }, query: {}, headers: {}, body: { delegateId: 'subject-grace', rights: ['invite-members'], startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-01-15T00:00:00.000Z' }, raw: undefined },
      { validateResponses: true, resolvePrincipal: () => caller },
    );

    expect(route.path).toBe('/organisations/:organisationId/delegations');
    expect([response.status, response.body]).toEqual([201, { id: 'delegation-1' }]);
    expect(sent).toMatchObject([{ organisationId: 'acme', terms: { delegateId: 'subject-grace', rights: ['invite-members'], startsAt: new Date('2026-01-01T00:00:00.000Z'), endsAt: new Date('2026-01-15T00:00:00.000Z') } }]);
  });

  it('refuses with 422 a request its contract does not describe, and sends nothing', async () => {
    const { route, sent } = arrange();

    const response = await executeRoute(
      route,
      { params: { organisationId: 'acme' }, query: {}, headers: {}, body: { delegateId: 'subject-grace', rights: ['rule-the-world'], startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-01-15T00:00:00.000Z' }, raw: undefined },
      { resolvePrincipal: () => caller },
    );

    expect(response.status).toBe(422);
    expect(sent).toEqual([]);
  });

  it('is listed in the Nest controllers of the context, which say what its signature takes and answers', () => {
    expect({{context.camel}}Controllers).toContain(GrantDelegationController);
  });
});

/** The route, on a bus that keeps what it was sent and answers as the use case would. */
function arrange() {
  const sent: GrantDelegationCommand[] = [];

  const commands = new InMemoryCommandBus().register(GrantDelegationCommand, {
    execute: async (command) => {
      sent.push(command);

      return 'delegation-1';
    },
  });

  const route = nestControllerRoute(GrantDelegationController, {
    instanceOf: () => new GrantDelegationController(commands),
    // A DTO without a decorated field accepts the empty object alone: whitelist and forbidNonWhitelisted refuse any field.
    schemaOfClass: (dto) => classSchema(dto, { validator: { forbidUnknownValues: false } }),
  });

  return { route, sent };
}
