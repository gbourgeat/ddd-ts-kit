import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { OpenPracticeCommand } from '#src/contexts/identity/application/commands/open-practice/open-practice.command.js';
import { PersonNotRegisteredError } from '#src/contexts/identity/domain/errors/person-not-registered.error.js';
import { UnknownTimeZoneError } from '#src/contexts/identity/domain/errors/unknown-time-zone.error.js';
import { openPracticeRoute } from '#src/contexts/identity/presentation/http/open-practice.route.js';

const params = {};
const body = { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'person-1' };

describe('POST /practices', () => {
  it('answers 201 when the use case succeeds', async () => {
    const commands = new InMemoryCommandBus().register(OpenPracticeCommand, { execute: async () => 'open-practice-1' });

    const response = await executeRoute(
      openPracticeRoute(commands),
      { params, query: {}, headers: {}, body, raw: undefined },
      { validateResponses: true },
    );

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 'open-practice-1' });
  });

  it('hands the use case what the client sent', async () => {
    const sent: OpenPracticeCommand[] = [];

    const commands = new InMemoryCommandBus().register(OpenPracticeCommand, {
      execute: async (command) => {
        sent.push(command);

        return 'open-practice-1';
      },
    });

    await executeRoute(openPracticeRoute(commands), { params, query: {}, headers: {}, body, raw: undefined });

    expect(sent).toMatchObject([{ opening: { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'person-1' } }]);
  });

  it.each([
    ['a body without a name', { timeZone: 'Europe/Paris', managerId: 'person-1' }],
    ['a body without a time zone', { name: 'Riverside', managerId: 'person-1' }],
    ['a body without a first manager', { name: 'Riverside', timeZone: 'Europe/Paris' }],
    ['a time zone that is not a text', { name: 'Riverside', timeZone: 2, managerId: 'person-1' }],
  ])('refuses %s with 422', async (_what, malformed) => {
    const commands = new InMemoryCommandBus().register(OpenPracticeCommand, { execute: async () => 'open-practice-1' });

    const response = await executeRoute(openPracticeRoute(commands), {
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
    ['UNKNOWN_TIME_ZONE', new UnknownTimeZoneError('Mars/Olympus')],
    ['PERSON_NOT_REGISTERED', new PersonNotRegisteredError('person-1')],
  ])('answers 422 with the code %s when the use case refuses', async (code, refusal) => {
    const commands = new InMemoryCommandBus().register(OpenPracticeCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(openPracticeRoute(commands), {
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
