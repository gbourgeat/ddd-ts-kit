import { describe, expect, it } from 'vitest';
import type { Actor } from '@ddd-ts-kit/kernel';
import { passportPrincipal, type PassportStrategyLike } from '../src/passport';

const ada: Actor = { id: 'ada', type: 'user', roles: ['accountant'], attributes: {} };

/** A strategy that fails every request with the challenge it is given, as `passport-jwt` hands on the info of its callback. */
function failingWith(challenge: unknown): PassportStrategyLike {
  return {
    authenticate(this: { fail: (challenge: unknown) => void }) {
      this.fail(challenge);
    },
  };
}

const refusalOf = (challenge: unknown): Promise<unknown> =>
  passportPrincipal(failingWith(challenge), { actorOf: () => ada })({
    headers: { authorization: 'Bearer token' },
  }).catch((error: unknown) => error);

describe('passportPrincipal, the reason of a refusal', () => {
  it('gives the refusal the reason code the strategy failed with', async () => {
    const refusal = await refusalOf({ message: 'NO_EXPIRY' });

    expect(refusal).toMatchObject({ code: 'UNAUTHORIZED', reason: 'NO_EXPIRY' });
  });

  it('refuses any other failure as refused-by-strategy, the message of a library being no code', async () => {
    const library = await refusalOf(new Error('invalid signature'));
    const challenge = await refusalOf('Bearer');
    const bare = await refusalOf(undefined);

    expect(library).toMatchObject({ code: 'UNAUTHORIZED', reason: 'refused-by-strategy' });
    expect(challenge).toMatchObject({ reason: 'refused-by-strategy' });
    expect(bare).toMatchObject({ reason: 'refused-by-strategy' });
  });
});
