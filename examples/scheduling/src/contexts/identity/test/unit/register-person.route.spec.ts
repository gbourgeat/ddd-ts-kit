import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { RegisterPersonCommand } from '../../application/commands/register-person/register-person.command.js';
import { InvalidDisplayNameError } from '../../domain/errors/invalid-display-name.error.js';
import { InvalidEmailError } from '../../domain/errors/invalid-email.error.js';
import { registerPersonRoute } from '../../presentation/http/register-person.route.js';

const params = {};
const body = { displayName: 'Ada Lovelace', email: 'ada@example.com' };

describe('PUT /people/me', () => {
  it('answers 200 when the use case succeeds', async () => {
    const commands = new InMemoryCommandBus().register(RegisterPersonCommand, { execute: async () => 'register-person-1' });

    const response = await executeRoute(registerPersonRoute(commands), { params, query: {}, headers: {}, body, raw: undefined }, { validateResponses: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'register-person-1' });
  });

  it('hands the use case what the client sent', async () => {
    const sent: RegisterPersonCommand[] = [];

    const commands = new InMemoryCommandBus().register(RegisterPersonCommand, {
      execute: async (command) => {
        sent.push(command);

        return 'register-person-1';
      },
    });

    await executeRoute(registerPersonRoute(commands), { params, query: {}, headers: {}, body, raw: undefined });

    expect(sent).toMatchObject([{ displayName: 'Ada Lovelace', email: 'ada@example.com' }]);
  });

  it.each([
    ['a body without a name', { email: 'ada@example.com' }],
    ['an empty name', { displayName: '', email: 'ada@example.com' }],
    ['a body without an address', { displayName: 'Ada Lovelace' }],
    ['an address that is not an email', { displayName: 'Ada Lovelace', email: 'ada' }],
  ])('refuses %s with 422', async (_what, malformed) => {
    const commands = new InMemoryCommandBus().register(RegisterPersonCommand, { execute: async () => 'register-person-1' });

    const response = await executeRoute(registerPersonRoute(commands), { params, query: {}, headers: {}, body: malformed, raw: undefined });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it.each([
    ['INVALID_DISPLAY_NAME', new InvalidDisplayNameError()],
    ['INVALID_EMAIL', new InvalidEmailError('x')],
  ])('answers 422 with the code %s when the use case refuses', async (code, refusal) => {
    const commands = new InMemoryCommandBus().register(RegisterPersonCommand, {
      execute: async () => {
        throw refusal;
      },
    });

    const response = await executeRoute(registerPersonRoute(commands), { params, query: {}, headers: {}, body, raw: undefined });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code });
  });
});
