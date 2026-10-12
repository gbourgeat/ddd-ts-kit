import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { GrantDelegationCommand } from '@/contexts/identity/application/commands/grant-delegation/grant-delegation.command';
import { DelegationError } from '@/contexts/identity/domain/errors/delegation.error';
import { PracticeError } from '@/contexts/identity/domain/errors/practice.error';
import { grantDelegationRoute } from '@/contexts/identity/presentation/http/grant-delegation.route';

const params = { practiceId: 'practice-1', practitionerId: 'person-2' };
const body = { assistantId: 'person-3', availabilityIncluded: true, endsAt: '2026-06-01T00:00:00.000Z' };

describe('POST /practices/:practiceId/desks/:practitionerId/delegations', () => {
  it('answers 201 when the use case succeeds', async () => {
    const commands = new InMemoryCommandBus().register(GrantDelegationCommand, {
      execute: async () => 'grant-delegation-1',
    });

    const response = await executeRoute(
      grantDelegationRoute(commands),
      { params, query: {}, headers: {}, body, raw: undefined },
      { validateResponses: true },
    );

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 'grant-delegation-1' });
  });

  it('hands the use case what the client sent', async () => {
    const sent: GrantDelegationCommand[] = [];

    const commands = new InMemoryCommandBus().register(GrantDelegationCommand, {
      execute: async (command) => {
        sent.push(command);

        return 'grant-delegation-1';
      },
    });

    await executeRoute(grantDelegationRoute(commands), { params, query: {}, headers: {}, body, raw: undefined });

    expect(sent).toMatchObject([
      {
        desk: { practiceId: 'practice-1', practitionerId: 'person-2' },
        terms: { assistantId: 'person-3', availabilityIncluded: true, endsAt: new Date('2026-06-01T00:00:00.000Z') },
      },
    ]);
  });

  it('hands the use case a delegation without an end when the client gives none', async () => {
    const sent: GrantDelegationCommand[] = [];

    const commands = new InMemoryCommandBus().register(GrantDelegationCommand, {
      execute: async (command) => {
        sent.push(command);

        return 'grant-delegation-1';
      },
    });

    const openEnded = { assistantId: 'person-3', availabilityIncluded: false };

    await executeRoute(grantDelegationRoute(commands), {
      params,
      query: {},
      headers: {},
      body: openEnded,
      raw: undefined,
    });

    expect(sent.map((command) => command.terms)).toEqual([openEnded]);
  });

  it.each([
    ['a body without an assistant', { availabilityIncluded: true }],
    [
      'an availability that is neither included nor left out',
      { assistantId: 'person-3', availabilityIncluded: 'maybe' },
    ],
    ['an end that is not a date', { assistantId: 'person-3', availabilityIncluded: true, endsAt: 'tomorrow' }],
  ])('refuses %s with 422', async (_what, malformed) => {
    const commands = new InMemoryCommandBus().register(GrantDelegationCommand, {
      execute: async () => 'grant-delegation-1',
    });

    const response = await executeRoute(grantDelegationRoute(commands), {
      params,
      query: {},
      headers: {},
      body: malformed,
      raw: undefined,
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it.each([
    ['PRACTICE_NOT_FOUND', PracticeError.notFound('practice-1')],
    ['NOT_A_PRACTITIONER', PracticeError.notAPractitioner('person-1')],
    ['NOT_AN_ASSISTANT', PracticeError.notAnAssistant('person-1')],
    ['DELEGATION_ENDS_IN_THE_PAST', DelegationError.endsInThePast(new Date('2020-01-01T00:00:00.000Z'))],
    ['DELEGATION_ALREADY_ACTIVE', DelegationError.alreadyActive('delegation-1')],
  ])('answers 422 with the code %s when the use case refuses', async (code, refusal) => {
    const commands = new InMemoryCommandBus().register(GrantDelegationCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(grantDelegationRoute(commands), {
      params,
      query: {},
      headers: {},
      body,
      raw: undefined,
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code });
  });
});
