import { describe, expect, it } from 'vitest';
import { anonymousActor, type Actor, type Session } from '@ddd-ts-kit/kernel';
import {
  Controller,
  ForbiddenError,
  HasRole,
  HasScope,
  RouteGroup,
  controllerRoutes,
  executeRoute,
  tenantFromHeader,
  type GuardRefusal,
  type RawRequest,
} from '../src/index.js';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: ['clerk'], attributes: {} };

const sessionOf = (scopes?: readonly string[]): Session => ({
  id: 'session-1',
  actor: ada,
  issuedAt: new Date(0),
  authenticationMethod: 'token',
  ...(scopes === undefined ? {} : { scopes }),
  extensions: {},
});

const request = (headers: RawRequest['headers'] = {}): RawRequest => ({
  params: {},
  query: {},
  headers,
  body: undefined,
  raw: undefined,
});

/* Declared by calling the decorators: the specs are not compiled with decorators. */
class InvoicesRoutes {}

RouteGroup({ prefix: '/invoices', tags: ['billing'], guards: [HasScope('invoices:read'), HasRole('clerk')] })(
  InvoicesRoutes,
);

class ListInvoicesController {
  handle(): Promise<void> {
    return Promise.resolve();
  }
}

class VoidInvoiceController {
  handle(): Promise<void> {
    return Promise.reject(new ForbiddenError('refused by the use case'));
  }
}

Controller({ group: InvoicesRoutes, method: 'GET', path: '/', summary: 'List invoices', response: { status: 204 } })(
  ListInvoicesController,
);

Controller({
  group: InvoicesRoutes,
  method: 'POST',
  path: '/void',
  summary: 'Void invoice',
  response: { status: 204 },
})(VoidInvoiceController);

function routeOf(refuse = false) {
  const [route] = controllerRoutes([refuse ? new VoidInvoiceController() : new ListInvoicesController()]);

  if (route === undefined) {
    throw new Error('no route');
  }

  return route;
}

async function refusalsOf(session: Session | Actor, refuse = false, headers: RawRequest['headers'] = {}) {
  const refusals: GuardRefusal[] = [];

  const response = await executeRoute(routeOf(refuse), request(headers), {
    resolvePrincipal: () => session,
    resolveTenant: tenantFromHeader(),
    onGuardRefusal: (refusal) => {
      refusals.push(refusal);
    },
  });

  return { status: response.status, refusals };
}

describe('HasScope', () => {
  it('lets through a session granted every scope named, and refuses the others', async () => {
    expect((await refusalsOf(sessionOf(['invoices:read']))).status).toBe(204);
    expect((await refusalsOf(sessionOf(['invoices:write']))).status).toBe(403);
    expect((await refusalsOf(sessionOf())).status).toBe(403);
    expect((await refusalsOf(anonymousActor())).status).toBe(401);
    expect(() => HasScope()).toThrow('names no scope');
  });
});

describe('a refusal at the edge', () => {
  it('is reported with the request it refused, and a refusal of the use case is not', async () => {
    const refused = await refusalsOf(sessionOf());

    expect(refused.refusals).toHaveLength(1);

    expect(refused.refusals[0]).toMatchObject({
      operationId: 'listInvoices',
      problem: { status: 403, code: 'FORBIDDEN' },
      execution: { actor: ada, tenantId: 'acme', session: { id: 'session-1' } },
    });

    expect((await refusalsOf(sessionOf(['invoices:read']), true)).refusals).toEqual([]);
  });

  it('is reported for a tenant the caller does not belong to, and a failing hook changes nothing', async () => {
    const elsewhere = await refusalsOf(sessionOf(['invoices:read']), false, { 'x-tenant-id': 'globex' });

    expect(elsewhere.status).toBe(403);
    expect(elsewhere.refusals[0]?.execution.tenantId).toBe('acme');

    const response = await executeRoute(routeOf(), request(), {
      resolvePrincipal: () => sessionOf(),
      onGuardRefusal: () => Promise.reject(new Error('trail down')),
    });

    expect(response.status).toBe(403);
  });

  it('is not reported when a guard fails instead of refusing', async () => {
    class FaultyRoutes {}

    class FaultyController {
      handle(): Promise<void> {
        return Promise.resolve();
      }
    }

    const failing = { check: () => Promise.reject(new Error('directory down')) };

    RouteGroup({ prefix: '/faulty', guards: [failing] })(FaultyRoutes);

    Controller({ group: FaultyRoutes, method: 'GET', path: '/', summary: 'Faulty', response: { status: 204 } })(
      FaultyController,
    );

    const [route] = controllerRoutes([new FaultyController()]);
    const refusals: GuardRefusal[] = [];

    const response = await executeRoute(route ?? routeOf(), request(), {
      resolvePrincipal: () => sessionOf(),
      onGuardRefusal: (refusal) => {
        refusals.push(refusal);
      },
    });

    expect(response.status).toBe(500);
    expect(refusals).toEqual([]);
  });
});
