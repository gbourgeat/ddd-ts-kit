import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AsyncLocalStorageExecutionScope,
  anonymousActor,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  TenantMember,
  defineRoute,
  executeRoute,
  firstTenantOf,
  servedTenantOf,
  tenantFromClaim,
  tenantFromHeader,
  tenantFromPath,
  tenantFromSubdomain,
  type RawRequest,
  type TenantRequest,
} from '../src/index.js';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };
const consultant: Actor = { id: 'cy', type: 'user', tenantId: 'acme', roles: [], attributes: { tenants: ['globex'] } };
const staff: Actor = { id: 'sam', type: 'user', roles: ['support'], attributes: {} };

const tenantRequest = (overrides: Partial<TenantRequest>): TenantRequest => ({
  headers: {},
  params: {},
  actor: ada,
  ...overrides,
});

const request = (headers: RawRequest['headers'], params: unknown = {}): RawRequest => ({
  params,
  query: {},
  headers,
  body: undefined,
  raw: undefined,
});

function recordingRoute() {
  const seen: { execution?: ExecutionContext } = {};

  const route = defineRoute(
    {
      method: 'GET',
      path: '/tenants/:tenantId/invoices',
      operationId: 'invoices',
      summary: 'List invoices',
      request: { params: zodSchema(z.object({ tenantId: z.string() })) },
      responses: { 204: { description: 'Done.' } },
      security: ['bearer'],
    },
    ({ context }) => {
      seen.execution = context.execution;

      return { status: 204 };
    },
  );

  return { route, seen };
}

describe('the resolvers of the tenant of a request', () => {
  it('read the subdomain under a base domain, and nothing else', () => {
    const resolve = tenantFromSubdomain('App.Example.com');
    const at = (host: string) => resolve(tenantRequest({ headers: { host } }));

    expect(at('acme.app.example.com')).toBe('acme');
    expect(at('ACME.app.example.com:8443')).toBe('acme');
    expect(at('app.example.com')).toBeUndefined();
    expect(at('a.b.app.example.com')).toBeUndefined();
    expect(at('acme.example.org')).toBeUndefined();
    expect(resolve(tenantRequest({}))).toBeUndefined();
  });

  it('read a header, a path parameter or the claim, and take the first that names one', () => {
    expect(tenantFromHeader()(tenantRequest({ headers: { 'x-tenant-id': ' globex ' } }))).toBe('globex');
    expect(tenantFromHeader('X-Org')(tenantRequest({ headers: { 'x-org': ['a', 'b'] } }))).toBeUndefined();
    expect(tenantFromPath()(tenantRequest({ params: { tenantId: 'globex' } }))).toBe('globex');
    expect(tenantFromPath('org')(tenantRequest({ params: { org: '' } }))).toBeUndefined();
    expect(tenantFromClaim()(tenantRequest({}))).toBe('acme');

    const resolve = firstTenantOf(tenantFromHeader(), tenantFromClaim());

    expect(resolve(tenantRequest({ headers: { 'x-tenant-id': 'globex' } }))).toBe('globex');
    expect(resolve(tenantRequest({}))).toBe('acme');
    expect(resolve(tenantRequest({ actor: staff }))).toBeUndefined();
  });
});

describe('a request in the tenant it names', () => {
  it('runs in that tenant when the caller belongs to it', async () => {
    const { route, seen } = recordingRoute();
    const scope = new AsyncLocalStorageExecutionScope();

    const response = await executeRoute(route, request({}, { tenantId: 'globex' }), {
      resolvePrincipal: () => consultant,
      resolveTenant: tenantFromPath(),
      executionScope: scope,
    });

    expect(response.status).toBe(204);
    expect(seen.execution).toMatchObject({ actor: consultant, tenantId: 'globex' });
  });

  it('is refused before any handler when the caller does not belong to it', async () => {
    const { route, seen } = recordingRoute();

    const response = await executeRoute(route, request({}, { tenantId: 'globex' }), {
      resolvePrincipal: () => ada,
      resolveTenant: tenantFromPath(),
    });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
    expect(seen.execution).toBeUndefined();
  });

  it('keeps the tenant an anonymous caller addressed, and the actor tenant when none is named', async () => {
    const anonymous = recordingRoute();

    await executeRoute(anonymous.route, request({ 'x-tenant-id': 'globex' }, { tenantId: 'x' }), {
      resolveTenant: tenantFromHeader(),
    });

    expect(anonymous.seen.execution).toMatchObject({ actor: anonymousActor(), tenantId: 'globex' });

    const own = recordingRoute();

    await executeRoute(own.route, request({}, { tenantId: 'x' }), {
      resolvePrincipal: () => ada,
      resolveTenant: tenantFromHeader(),
    });

    expect(own.seen.execution?.tenantId).toBe('acme');
  });

  it('answers 404 to a tenant id that could widen a read, anonymous or not, before any handler', async () => {
    for (const [tenantId, principal] of [
      ['*', undefined],
      ['acme,globex', undefined],
      ['acme:products', undefined],
      ['*', ada],
    ] as const) {
      const { route, seen } = recordingRoute();

      const response = await executeRoute(route, request({ 'x-tenant-id': tenantId }, { tenantId: 'x' }), {
        resolveTenant: tenantFromHeader(),
        ...(principal === undefined ? {} : { resolvePrincipal: () => principal }),
      });

      expect(response.status).toBe(404);
      expect(seen.execution).toBeUndefined();
    }
  });

  it('answers 404 to a tenant the deployment does not serve, even to a caller of that tenant', async () => {
    const resolveTenant = servedTenantOf(firstTenantOf(tenantFromHeader(), tenantFromClaim()), ['globex']);

    const answered = async (principal: Actor, headers: RawRequest['headers']) => {
      const { route, seen } = recordingRoute();

      const response = await executeRoute(route, request(headers, { tenantId: 'x' }), {
        resolvePrincipal: () => principal,
        resolveTenant,
      });

      return { status: response.status, tenantId: seen.execution?.tenantId };
    };

    expect(await answered(ada, {})).toEqual({ status: 404, tenantId: undefined });
    expect(await answered(consultant, { 'x-tenant-id': 'globex' })).toEqual({ status: 204, tenantId: 'globex' });
    expect(await answered(staff, {})).toEqual({ status: 204, tenantId: undefined });
  });
});

describe('TenantMember', () => {
  const check = (actor: Actor, tenantId?: string) => {
    const execution = executionContext({
      correlationId: 'c',
      actor,
      origin: 'http',
      ...(tenantId === undefined ? {} : { tenantId }),
    });

    return () =>
      TenantMember.check({
        method: 'GET',
        path: '/invoices',
        operationId: 'invoices',
        params: {},
        headers: {},
        actor,
        context: {
          requestId: 'r',
          raw: undefined,
          execution: { ...execution, correlationId: 'c', origin: 'http', extensions: {} },
        },
      });
  };

  it('lets a member of the tenant of the request through, and nobody else', () => {
    expect(check(ada, 'acme')).not.toThrow();
    expect(check(consultant, 'globex')).not.toThrow();
    expect(check(ada, 'globex')).toThrow('members of a tenant');
    expect(check(staff)).toThrow('members of a tenant');
    expect(check(staff, 'acme')).toThrow('members of a tenant');
    expect(check(anonymousActor(), 'acme')).toThrow('Authentication is required');
    expect(TenantMember.documents?.errors).toEqual(['UNAUTHORIZED', 'FORBIDDEN']);
  });
});
