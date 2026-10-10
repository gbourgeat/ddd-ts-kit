import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageActorContext,
  AsyncLocalStorageExecutionScope,
  InMemoryQueryBus,
  ScopedActorContext,
  SequentialIdGenerator,
  anonymousActor,
  anonymousSession,
  executionContext,
  type Session,
} from '@ddd-ts-kit/kernel';
import { defineRoute, executeRoute, type RawRequest } from '@ddd-ts-kit/http';
import {
  AuthorizationMap,
  InvalidCredentialError,
  RoleBasedAuthorizer,
  actorOf,
  authorizationMiddleware,
  bearerCredential,
  inActorContext,
  principalResolver,
  requires,
  resolveSession,
  sessionOf,
  type Authenticator,
} from '../src/index.js';
import { FakeAuthenticator } from '../src/testing.js';
import { SearchInvoices, ada, billingPermissions, bob } from './support/billing.js';

describe('bearerCredential', () => {
  it('extracts the token of the Authorization header, whatever its case', () => {
    expect(bearerCredential({ authorization: 'Bearer abc.def-123' })).toBe('abc.def-123');
    expect(bearerCredential({ Authorization: 'bearer abc.def==' })).toBe('abc.def==');
  });

  it('gives nothing without the header', () => {
    expect(bearerCredential({})).toBeUndefined();
    expect(bearerCredential({ authorization: undefined, accept: '*/*' })).toBeUndefined();
  });

  it.each([['Basic YWRhOnNlY3JldA=='], ['Bearer'], ['Bearer a b'], ['abc'], ['']])(
    'refuses %j instead of treating the caller as anonymous',
    (value) => {
      expect(() => bearerCredential({ authorization: value })).toThrow(InvalidCredentialError);
    },
  );

  it('refuses a header sent several times', () => {
    expect(() => bearerCredential({ authorization: ['Bearer a', 'Bearer b'] })).toThrow(InvalidCredentialError);
  });
});

const supportAsAda: Session = {
  id: 'session-9',
  actor: ada,
  issuedAt: new Date('2026-03-01T09:00:00.000Z'),
  expiresAt: new Date('2026-03-01T17:00:00.000Z'),
  authenticationMethod: 'sso',
  impersonatedBy: 'support-7',
  extensions: {},
};

describe('principalResolver', () => {
  const resolve = principalResolver(new FakeAuthenticator({ 'token-of-ada': ada, 'token-of-support': supportAsAda }));

  it('turns the request of the framework into the session of its actor', async () => {
    const session = await resolve({ headers: { authorization: 'Bearer token-of-ada' } });

    expect(session.actor).toBe(ada);
    expect(actorOf(session)).toBe(ada);
  });

  it('answers the session the authenticator knows, impersonation included', async () => {
    expect(await resolve({ headers: { authorization: 'Bearer token-of-support' } })).toBe(supportAsAda);
  });

  it('answers the anonymous session without credential, whatever the request looks like', async () => {
    expect(await resolve({ headers: {} })).toEqual(anonymousSession());
    expect(await resolve({ headers: { 'x-count': 3 } })).toEqual(anonymousSession());
    expect(await resolve({})).toEqual(anonymousSession());
    expect(await resolve(undefined)).toEqual(anonymousSession());
  });

  it('refuses a credential nobody knows', async () => {
    const refusal = await resolve({ headers: { authorization: 'Bearer stolen' } }).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(InvalidCredentialError);
    expect(refusal).toMatchObject({ code: 'UNAUTHORIZED', reason: 'UNKNOWN_CREDENTIAL' });
  });
});

describe('actorOf', () => {
  it('reads the actor a boundary received, anonymous for anything else', () => {
    expect(actorOf(ada)).toBe(ada);
    expect(actorOf(supportAsAda)).toBe(ada);
    expect(actorOf({ principal: supportAsAda })).toBe(ada);
    expect(actorOf(undefined)).toEqual(anonymousActor());
    expect(actorOf({ sub: 'ada' })).toEqual(anonymousActor());
  });
});

describe('sessionOf', () => {
  it('reads the session of a principal or of the request context that holds it', () => {
    expect(sessionOf(supportAsAda)).toBe(supportAsAda);
    expect(sessionOf({ requestId: 'req-1', principal: supportAsAda })).toBe(supportAsAda);
  });

  it('says only what is known of an actor that came without a session', () => {
    expect(sessionOf(ada)).toEqual({
      id: 'ada',
      actor: ada,
      issuedAt: new Date(0),
      authenticationMethod: 'token',
      extensions: {},
    });
  });

  it('answers the anonymous session for anything else', () => {
    expect(sessionOf(undefined)).toBe(anonymousSession());
    expect(sessionOf(anonymousActor())).toBe(anonymousSession());
    expect(sessionOf({ requestId: 'req-1' })).toBe(anonymousSession());
    expect(sessionOf({ principal: { sub: 'ada' } })).toBe(anonymousSession());
  });
});

describe('resolveSession', () => {
  it('derives a session from an authenticator that only knows actors', async () => {
    const actorsOnly: Authenticator = { authenticate: async () => bob };

    expect(await resolveSession(actorsOnly, 'anything')).toMatchObject({ id: 'bob', actor: bob });
  });

  it('asks a session authenticator for the session it knows', async () => {
    const sessions = new FakeAuthenticator({ 'token-of-support': supportAsAda });

    expect(await resolveSession(sessions, 'token-of-support')).toBe(supportAsAda);
    expect(await sessions.authenticate('token-of-support')).toBe(ada);
    expect(await resolveSession(sessions, undefined)).toBe(anonymousSession());
  });
});

describe('a route of @ddd-ts-kit/http', () => {
  const actorContext = new AsyncLocalStorageActorContext();
  const seenByInfrastructure: (string | undefined)[] = [];

  const queries = new InMemoryQueryBus()
    .use(
      authorizationMiddleware({
        authorizer: new RoleBasedAuthorizer({ roles: { accountant: [billingPermissions['invoice.read']] } }),
        map: AuthorizationMap.of(requires(SearchInvoices, billingPermissions['invoice.read'])),
      }),
    )
    .register(SearchInvoices, {
      execute: async () => {
        seenByInfrastructure.push(actorContext.current()?.id);

        return ['inv-1'];
      },
    });

  const searchInvoices = defineRoute(
    {
      method: 'GET',
      path: '/invoices',
      operationId: 'searchInvoices',
      summary: 'Search invoices',
      responses: { 200: { description: 'The invoices' } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN'],
      security: ['bearer'],
    },
    inActorContext(actorContext, async ({ context }) => {
      await queries.execute(new SearchInvoices(actorOf(context.principal)));

      return { status: 200 as const };
    }),
  );

  const resolvePrincipal = principalResolver(new FakeAuthenticator({ 'token-of-ada': ada, 'token-of-bob': bob }));

  const call = (authorization?: string) => {
    const headers = authorization === undefined ? {} : { authorization };
    const request: RawRequest = { params: {}, query: {}, headers, body: undefined, raw: { headers } };

    return executeRoute(searchInvoices, request, { resolvePrincipal });
  };

  it('answers 200 to an actor holding the permission, seen by infrastructure through the actor context', async () => {
    expect((await call('Bearer token-of-ada')).status).toBe(200);
    expect(seenByInfrastructure).toEqual(['ada']);
    expect(actorContext.current()).toBeUndefined();
  });

  it('answers 401 without credential and with a refused one, with no extra wiring', async () => {
    expect(await call()).toMatchObject({ status: 401, body: { code: 'UNAUTHORIZED' } });
    expect(await call('Bearer stolen')).toMatchObject({ status: 401, body: { code: 'UNAUTHORIZED' } });
  });

  it('answers 403 to an actor without the permission', async () => {
    expect(await call('Bearer token-of-bob')).toMatchObject({ status: 403, body: { code: 'FORBIDDEN' } });
  });
});

describe('a route of @ddd-ts-kit/http given an execution scope', () => {
  const executionScope = new AsyncLocalStorageExecutionScope();
  const actorContext = new ScopedActorContext(executionScope, new SequentialIdGenerator('corr'));
  const seen: unknown[] = [];

  const whoAmI = defineRoute(
    {
      method: 'GET',
      path: '/me',
      operationId: 'whoAmI',
      summary: 'Read the caller',
      responses: { 204: { description: 'Seen' } },
      security: ['bearer'],
    },
    ({ context }) => {
      const ambient = executionScope.require();

      seen.push({
        session: sessionOf(context).id,
        actor: actorContext.require().id,
        impersonatedBy: ambient.session?.impersonatedBy,
        tenantId: ambient.tenantId,
        sameContext: ambient === context.execution,
      });

      return { status: 204 as const };
    },
  );

  const resolvePrincipal = principalResolver(new FakeAuthenticator({ 'token-of-support': supportAsAda }));

  it('runs the handler in the session of the caller, with no wrapper around the handler', async () => {
    const headers = { authorization: 'Bearer token-of-support' };
    const request: RawRequest = { params: {}, query: {}, headers, body: undefined, raw: { headers } };

    await executeRoute(whoAmI, request, { resolvePrincipal, executionScope });

    expect(seen).toEqual([
      { session: 'session-9', actor: 'ada', impersonatedBy: 'support-7', tenantId: ada.tenantId, sameContext: true },
    ]);

    expect(executionScope.current()).toBeUndefined();
  });

  it('keeps inActorContext working inside it, for routes written before', async () => {
    const legacy = inActorContext(actorContext, () => actorContext.require().id);
    const context = executionContext({ correlationId: 'corr-1', actor: anonymousActor(), origin: 'http' });

    expect(executionScope.run(context, () => legacy({ context: { principal: supportAsAda } }))).toBe('ada');
  });
});
