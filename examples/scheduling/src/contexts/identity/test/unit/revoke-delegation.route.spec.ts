import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { RevokeDelegationCommand } from '../../application/commands/revoke-delegation/revoke-delegation.command.js';
import { DelegationNotActiveError } from '../../domain/errors/delegation-not-active.error.js';
import { DelegationNotFoundError } from '../../domain/errors/delegation-not-found.error.js';
import { revokeDelegationRoute } from '../../presentation/http/revoke-delegation.route.js';

const params = { practiceId: 'practice-1', practitionerId: 'person-2', delegationId: 'delegation-1' };
const body = undefined;

describe('DELETE /practices/:practiceId/desks/:practitionerId/delegations/:delegationId', () => {
  it('answers 200 when the use case succeeds', async () => {
    const commands = new InMemoryCommandBus().register(RevokeDelegationCommand, { execute: async () => 'revoke-delegation-1' });

    const response = await executeRoute(revokeDelegationRoute(commands), { params, query: {}, headers: {}, body, raw: undefined }, { validateResponses: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'revoke-delegation-1' });
  });

  it('hands the use case what the client sent', async () => {
    const sent: RevokeDelegationCommand[] = [];

    const commands = new InMemoryCommandBus().register(RevokeDelegationCommand, {
      execute: async (command) => {
        sent.push(command);

        return 'revoke-delegation-1';
      },
    });

    await executeRoute(revokeDelegationRoute(commands), { params, query: {}, headers: {}, body, raw: undefined });

    expect(sent).toMatchObject([{ desk: { practiceId: 'practice-1', practitionerId: 'person-2' }, delegationId: 'delegation-1' }]);
  });

  it.each([
    ['DELEGATION_NOT_FOUND', new DelegationNotFoundError('delegation-1')],
    ['DELEGATION_NOT_ACTIVE', new DelegationNotActiveError('delegation-1')],
  ])('answers 422 with the code %s when the use case refuses', async (code, refusal) => {
    const commands = new InMemoryCommandBus().register(RevokeDelegationCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(revokeDelegationRoute(commands), { params, query: {}, headers: {}, body, raw: undefined });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code });
  });
});
