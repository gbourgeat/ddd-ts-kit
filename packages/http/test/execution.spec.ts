import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  anonymousActor,
  type Actor,
  type ExecutionContext,
  type Session,
} from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { UnauthorizedError, defineRoute, executeRoute, type ErrorContext, type RawRequest } from '../src/index.js';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: ['clerk'], attributes: {} };

const session: Session = {
  id: 'session-1',
  actor: ada,
  issuedAt: new Date('2026-03-01T09:00:00.000Z'),
  authenticationMethod: 'sso',
  locale: 'fr-FR',
  extensions: {},
};

const request = (headers: RawRequest['headers'] = {}): RawRequest => ({
  params: {},
  query: {},
  headers,
  body: undefined,
  raw: undefined,
});

function recordingRoute(scope?: AsyncLocalStorageExecutionScope) {
  const seen: { handed?: ExecutionContext; ambient?: ExecutionContext | undefined } = {};

  const route = defineRoute(
    {
      method: 'GET',
      path: '/work',
      operationId: 'work',
      summary: 'Do some work',
      request: { query: zodSchema(z.object({ fail: z.string().optional() })) },
      responses: { 204: { description: 'Done.' } },
      security: ['bearer'],
    },
    ({ context }) => {
      seen.handed = context.execution;
      seen.ambient = scope?.current();

      return { status: 204 };
    },
  );

  return { route, seen };
}

describe('the execution context of a request', () => {
  it('is built for every request, anonymous and correlated by the request id by default', async () => {
    const { route, seen } = recordingRoute();

    const response = await executeRoute(route, request({ 'x-request-id': 'req-7' }));

    expect(seen.handed).toEqual({
      correlationId: 'req-7',
      actor: anonymousActor(),
      origin: 'http',
      extensions: {},
    });

    expect(response.headers).toMatchObject({ 'x-request-id': 'req-7', 'x-correlation-id': 'req-7' });
  });

  it('continues a well-formed incoming correlation and echoes it', async () => {
    const { route, seen } = recordingRoute();

    const response = await executeRoute(route, request({ 'x-request-id': 'req-7', 'x-correlation-id': 'corr-1' }));

    expect(seen.handed?.correlationId).toBe('corr-1');
    expect(response.headers['x-correlation-id']).toBe('corr-1');
  });

  it('ignores an incoming correlation that could be an injection, or sent several times', async () => {
    const { route, seen } = recordingRoute();

    await executeRoute(route, request({ 'x-request-id': 'req-7', 'x-correlation-id': 'a b\nc' }));
    expect(seen.handed?.correlationId).toBe('req-7');

    await executeRoute(route, request({ 'x-request-id': 'req-8', 'x-correlation-id': ['corr-1', 'corr-2'] }));
    expect(seen.handed?.correlationId).toBe('req-8');
  });

  it('carries the session, its actor, tenant and locale when the principal is a session', async () => {
    const { route, seen } = recordingRoute();

    await executeRoute(route, request({ 'accept-language': 'en' }), { resolvePrincipal: () => session });

    expect(seen.handed).toMatchObject({ actor: ada, session, tenantId: 'acme', locale: 'fr-FR' });
  });

  it('carries the actor alone when the principal is an actor', async () => {
    const { route, seen } = recordingRoute();

    await executeRoute(route, request(), { resolvePrincipal: () => ada });

    expect(seen.handed).toMatchObject({ actor: ada, tenantId: 'acme' });
    expect(seen.handed).not.toHaveProperty('session');
  });

  it('stays anonymous for a principal of a shape of the project', async () => {
    const { route, seen } = recordingRoute();

    await executeRoute(route, request(), { resolvePrincipal: () => ({ subject: 'ada' }) });

    expect(seen.handed?.actor).toEqual(anonymousActor());
  });

  it.each([
    ['fr-FR,fr;q=0.9,en;q=0.8', 'fr-FR'],
    ['en;q=0.5, de-CH;q=0.9', 'de-CH'],
    ['*', undefined],
    ['fr;q=0', undefined],
    ['<script>', undefined],
  ])('reads the locale of Accept-Language %j as %j', async (header, locale) => {
    const { route, seen } = recordingRoute();

    await executeRoute(route, request({ 'accept-language': header }));

    expect(seen.handed?.locale).toBe(locale);
  });
});

describe('the execution context around the handler', () => {
  it('gives a deadline counted from the arrival when the requests have a time budget', async () => {
    const { route, seen } = recordingRoute();
    const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));

    await executeRoute(route, request(), { requestTimeoutMs: 2_500, clock });
    expect(seen.handed?.deadline).toEqual(new Date('2026-03-01T10:00:02.500Z'));

    await executeRoute(route, request());
    expect(seen.handed).not.toHaveProperty('deadline');
  });

  it('runs the handler inside the execution scope, with the very context it hands over', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const { route, seen } = recordingRoute(scope);

    await executeRoute(route, request(), { executionScope: scope, resolvePrincipal: () => session });

    expect(seen.ambient).toBe(seen.handed);
    expect(seen.ambient?.actor).toBe(ada);
    expect(scope.current()).toBeUndefined();
  });

  it('opens the execution scope outside of withPrincipal', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const { route } = recordingRoute(scope);
    const seenByHook: (string | undefined)[] = [];

    await executeRoute(route, request({ 'x-correlation-id': 'corr-1' }), {
      executionScope: scope,
      withPrincipal: (_principal, work) => {
        seenByHook.push(scope.current()?.correlationId);

        return work();
      },
    });

    expect(seenByHook).toEqual(['corr-1']);
  });

  it('echoes the correlation on a problem and reports it to the error hook', async () => {
    const { route } = recordingRoute();
    const reported: ErrorContext[] = [];

    const response = await executeRoute(
      { ...route, request: { query: zodSchema(z.object({ fail: z.string() })) } },
      request({ 'x-correlation-id': 'corr-1', 'x-request-id': 'req-7' }),
      { onError: (_error, context) => reported.push(context) },
    );

    expect(response.status).toBe(422);
    expect(response.headers).toMatchObject({ 'x-request-id': 'req-7', 'x-correlation-id': 'corr-1' });
    expect(reported).toMatchObject([{ requestId: 'req-7', correlationId: 'corr-1' }]);
  });
});

describe('defineRoute security', () => {
  const declare = (security: unknown) => () =>
    defineRoute(
      {
        method: 'GET',
        path: '/x',
        operationId: 'x',
        summary: 'x',
        responses: { 204: { description: 'ok' } },
        // @ts-expect-error the cases below are what the compiler refuses, sent by a JavaScript caller
        security,
      },
      () => ({ status: 204 }),
    );

  it('accepts named schemes, and false for a route anybody may call', () => {
    expect(declare(['bearer'])).not.toThrow();
    expect(declare(false)).not.toThrow();
  });

  it.each([[undefined], [[]], [true], ['bearer']])('refuses %j: a route is never public by omission', (security) => {
    expect(declare(security)).toThrow(/declare "security"/);
  });
});

describe('RouteSpec', () => {
  it('requires security at the type level, and at run time for who has no compiler', () => {
    const undeclared = () =>
      defineRoute(
        // @ts-expect-error security is required: deny by default at the type level
        {
          method: 'GET',
          path: '/typed',
          operationId: 'typed',
          summary: 'Typing',
          responses: { 204: { description: 'ok' } },
        },
        () => ({ status: 204 }),
      );

    expect(undeclared).toThrow(/declare "security"/);
  });
});

describe('what observes a request from outside', () => {
  const ping = defineRoute(
    {
      method: 'GET',
      path: '/orders/:orderId',
      operationId: 'getOrder',
      summary: 'Read',
      responses: { 204: { description: 'Found.' } },
      security: false,
    },
    async () => ({ status: 204 }),
  );

  it('wraps the whole handling, is told the route as declared, and answers what the pipeline answers', async () => {
    const seen: string[] = [];

    const response = await executeRoute(ping, request(), {
      around: async (route, respond) => {
        seen.push(`${route.method} ${route.path} ${route.operationId}`);

        const answered = await respond();

        seen.push(`answered ${answered.status}`);

        return answered;
      },
    });

    expect(response.status).toBe(204);
    expect(seen).toEqual(['GET /orders/:orderId getOrder', 'answered 204']);
  });

  it('sees a refusal as an answer: the problem, not an exception', async () => {
    const statuses: number[] = [];

    await executeRoute(ping, request(), {
      resolvePrincipal: () => {
        throw new UnauthorizedError('no credential');
      },
      around: async (_route, respond) => {
        const answered = await respond();

        statuses.push(answered.status);

        return answered;
      },
    });

    expect(statuses).toEqual([401]);
  });
});
