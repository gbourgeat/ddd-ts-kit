import 'reflect-metadata';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { SignJWT } from 'jose';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import { describe, expect, it } from 'vitest';
import { defineRoute, executeRoute, type RawRequest } from '@ddd-ts-kit/http';
import { anonymousSession, type Actor } from '@ddd-ts-kit/kernel';
import { InvalidCredentialError, actorOf } from '../src';
import { passportPrincipal, type PassportStrategyLike } from '../src/passport';

const SECRET = 'a secret of the tests, long enough for HS256';

const ada: Actor = { id: 'ada', type: 'user', roles: ['accountant'], attributes: {} };

/** A strategy that answers every request through the one action it is given. */
function answering(act: (strategy: Record<string, (...args: unknown[]) => void>) => void): PassportStrategyLike {
  return {
    authenticate(this: Record<string, (...args: unknown[]) => void>) {
      act(this);
    },
  };
}

const request = (authorization?: string) => ({ headers: authorization === undefined ? {} : { authorization } });

const toAda = { actorOf: () => ada };

describe('passportPrincipal, from what the strategy answers', () => {
  it('gives the session of the actor the user stands for, when the strategy succeeds', async () => {
    const infos: unknown[] = [];

    const resolve = passportPrincipal(
      answering((strategy) => strategy['success']?.({ sub: 'grace' }, { scope: 'read' })),
      {
        actorOf: (user, info) => {
          infos.push(info);

          return { ...ada, id: subjectOf(user) };
        },
      },
    );

    const session = await resolve(request('Bearer t'));

    expect(session.actor).toMatchObject({ id: 'grace' });
    expect(infos).toEqual([{ scope: 'read' }]);
  });

  it('refuses a credential the strategy fails, and lets a request without one through anonymous', async () => {
    const resolve = passportPrincipal(
      answering((strategy) => strategy['fail']?.('Bearer', 401)),
      toAda,
    );

    await expect(resolve(request('Bearer stolen'))).rejects.toBeInstanceOf(InvalidCredentialError);
    await expect(resolve(request())).resolves.toEqual(anonymousSession());
    await expect(resolve(request('   '))).resolves.toEqual(anonymousSession());
    await expect(resolve(null)).resolves.toEqual(anonymousSession());
    await expect(resolve({ headers: null })).resolves.toEqual(anonymousSession());
  });

  it('asks the project where its credential is, a cookie for one', async () => {
    const resolve = passportPrincipal(
      answering((strategy) => strategy['fail']?.()),
      { ...toAda, presented: (raw) => JSON.stringify(raw).includes('session=') },
    );

    await expect(resolve({ headers: { cookie: 'session=stolen' } })).rejects.toBeInstanceOf(InvalidCredentialError);
    await expect(resolve(request('Bearer ignored'))).resolves.toEqual(anonymousSession());
  });

  it('lets a request the strategy passes through anonymous', async () => {
    const resolve = passportPrincipal(
      answering((strategy) => strategy['pass']?.()),
      toAda,
    );

    await expect(resolve(request('Bearer t'))).resolves.toEqual(anonymousSession());
  });

  it('refuses the request on an error of the strategy, thrown or handed to error', async () => {
    const failing = new Error('the key set cannot be read');

    const handed = passportPrincipal(
      answering((strategy) => strategy['error']?.(failing)),
      toAda,
    );

    const thrown = passportPrincipal(
      answering(() => {
        throw failing;
      }),
      toAda,
    );

    await expect(handed(request('Bearer t'))).rejects.toBe(failing);
    await expect(thrown(request('Bearer t'))).rejects.toBe(failing);
  });

  it('refuses a strategy that redirects, a sign-in flow, and one that never answers', async () => {
    const redirecting = passportPrincipal(
      answering((strategy) => strategy['redirect']?.('https://login.example.test')),
      toAda,
    );

    const silent = passportPrincipal(
      answering(() => undefined),
      { ...toAda, timeoutMs: 20 },
    );

    await expect(redirecting(request())).rejects.toThrow(/redirects: it is a sign-in flow/);
    await expect(silent(request())).rejects.toThrow(/answered nothing within 20 ms/);
  });

  it('asks a lazy strategy at the first call, once the container that builds it has started', async () => {
    const container: { built?: PassportStrategyLike } = {};
    const resolve = passportPrincipal(() => container.built ?? answering((strategy) => strategy['pass']?.()), toAda);

    container.built = answering((strategy) => strategy['success']?.({}));

    await expect(resolve(request('Bearer t'))).resolves.toMatchObject({ actor: { id: 'ada' } });
  });
});

describe('passportPrincipal, on the strategies of passport-jwt and @nestjs/passport', () => {
  const options = { jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: SECRET };

  const tokenOf = (subject: string, secret = SECRET) =>
    new SignJWT({ roles: ['accountant'] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subject)
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(secret));

  /** As a project of Nest writes it, `@Injectable()` applied by a call: `validate` answers the user, which the kit turns into its actor. */
  class BearerStrategy extends PassportStrategy(JwtStrategy, 'bearer-of-the-tests') {
    constructor() {
      super(options);
    }

    validate(payload: { sub: string; roles: string[] }): { id: string; roles: string[] } {
      return { id: payload.sub, roles: payload.roles };
    }
  }

  Injectable()(BearerStrategy);

  const strategies: readonly (readonly [string, PassportStrategyLike])[] = [
    [
      'passport-jwt',
      new JwtStrategy(options, (payload: { sub: string; roles: string[] }, done) =>
        done(null, { id: payload.sub, roles: payload.roles }),
      ),
    ],
    ['@nestjs/passport', new BearerStrategy()],
  ];

  it.each(strategies)(
    'authenticates a signed token, refuses a forged one, and lets none through anonymous (%s)',
    async (_name, strategy) => {
      const resolve = passportPrincipal(strategy, {
        actorOf: accountOf,
      });

      await expect(resolve(request(`Bearer ${await tokenOf('ada')}`))).resolves.toMatchObject({
        actor: { id: 'ada', roles: ['accountant'] },
      });

      await expect(
        resolve(request(`Bearer ${await tokenOf('ada', 'another secret, long enough too')}`)),
      ).rejects.toBeInstanceOf(InvalidCredentialError);

      await expect(resolve(request())).resolves.toEqual(anonymousSession());
    },
  );

  it('answers 401 through the pipeline of the kit to a forged token, and serves a signed one', async () => {
    const whoAmI = defineRoute(
      {
        method: 'GET',
        path: '/me',
        operationId: 'whoAmI',
        summary: 'Who am I',
        responses: { 200: { description: 'The caller' } },
        errors: ['UNAUTHORIZED'],
        security: ['bearer'],
      },
      async ({ context }) => ({ status: 200 as const, headers: { 'x-caller': actorOf(context.principal).id } }),
    );

    const resolvePrincipal = passportPrincipal(new BearerStrategy(), {
      actorOf: accountOf,
    });

    const call = async (authorization: string) => {
      const headers = { authorization };
      const raw: RawRequest = { params: {}, query: {}, headers, body: undefined, raw: { headers } };

      return executeRoute(whoAmI, raw, { resolvePrincipal });
    };

    await expect(call(`Bearer ${await tokenOf('ada')}`)).resolves.toMatchObject({
      status: 200,
      headers: { 'x-caller': 'ada' },
    });

    await expect(call(`Bearer ${await tokenOf('ada', 'another secret, long enough too')}`)).resolves.toMatchObject({
      status: 401,
      body: { code: 'UNAUTHORIZED' },
    });
  });
});

/** What the verify callback of the tests hands to `done`, read as a project reads it. */
function accountOf(user: unknown): Actor {
  if (typeof user !== 'object' || user === null || !('id' in user) || typeof user.id !== 'string') {
    throw new Error('The strategy authenticated no account.');
  }

  const roles: unknown = 'roles' in user ? user.roles : [];

  return { id: user.id, type: 'user', roles: Array.isArray(roles) ? roles.map(String) : [], attributes: {} };
}

function subjectOf(user: unknown): string {
  return typeof user === 'object' && user !== null && 'sub' in user && typeof user.sub === 'string' ? user.sub : '';
}
