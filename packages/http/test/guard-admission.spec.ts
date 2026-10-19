import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { anonymousActor, type Actor, type Session } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  Authenticated,
  Controller,
  ForbiddenError,
  HasRole,
  RouteGroup,
  TenantMember,
  controllerRoutes,
  executeRoute,
  type Guard,
  type GuardRefusal,
  type RawRequest,
  type Route,
  type UploadReader,
} from '../src/index.js';
import { multipartUploads } from '../src/uploads.js';
import type { RunningServer } from './support/running-server.js';
import { UPLOAD, onExpress, onFastify, onHono } from './support/upload-desk.js';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: ['clerk'], attributes: {} };

const session: Session = {
  id: 'session-1',
  actor: ada,
  issuedAt: new Date(0),
  authenticationMethod: 'token',
  extensions: {},
};

const withdrawal = zodSchema(z.object({ reason: z.string().min(1) }));
const invoiceParams = zodSchema(z.object({ invoiceId: z.string().uuid() }));
const INVOICE_ID = '0b6c2f4e-1d2a-4f3b-9c8d-7e6f5a4b3c2d';

/* Declared by calling the decorators: the specs are not compiled with decorators. */
class InvoiceRoutes {}

RouteGroup({ prefix: '/invoices', guards: [Authenticated] })(InvoiceRoutes);

class WithdrawInvoiceController {
  handle(): Promise<void> {
    return Promise.resolve();
  }
}

Controller({
  group: InvoiceRoutes,
  method: 'POST',
  path: '/:invoiceId/withdrawal',
  summary: 'Withdraw invoice',
  params: invoiceParams,
  body: withdrawal,
  response: { status: 204 },
})(WithdrawInvoiceController);

class AuditInvoiceController {
  handle(): Promise<void> {
    return Promise.resolve();
  }
}

Controller({
  group: InvoiceRoutes,
  method: 'POST',
  path: '/:invoiceId/audit',
  summary: 'Audit invoice',
  guards: [HasRole('auditor')],
  params: invoiceParams,
  body: withdrawal,
  response: { status: 204 },
})(AuditInvoiceController);

class ListTenantInvoicesController {
  handle(): Promise<void> {
    return Promise.resolve();
  }
}

Controller({
  group: InvoiceRoutes,
  method: 'GET',
  path: '/:invoiceId/lines',
  summary: 'List tenant invoice lines',
  guards: [TenantMember],
  params: invoiceParams,
  response: { status: 204 },
})(ListTenantInvoicesController);

class AttachReceiptController {
  handle(): Promise<void> {
    return Promise.resolve();
  }
}

Controller({
  group: InvoiceRoutes,
  method: 'POST',
  path: '/receipts',
  summary: 'Attach receipt',
  body: zodSchema(z.object({ title: z.string().min(1) })),
  upload: UPLOAD,
  response: { status: 204 },
})(AttachReceiptController);

function only(routes: readonly Route[], operationId: string): Route {
  const found = routes.find((route) => route.operationId === operationId);

  if (found === undefined) {
    throw new Error(`no route ${operationId}`);
  }

  return found;
}

const routes = controllerRoutes([
  new WithdrawInvoiceController(),
  new AuditInvoiceController(),
  new ListTenantInvoicesController(),
]);

const post = (params: Record<string, string>, body: unknown): RawRequest => ({
  params,
  query: {},
  headers: { 'content-type': 'application/json' },
  body,
  raw: undefined,
});

async function answered(route: Route, request: RawRequest, principal: unknown) {
  const refusals: GuardRefusal[] = [];

  const response = await executeRoute(route, request, {
    resolvePrincipal: () => principal,
    onGuardRefusal: (refusal) => {
      refusals.push(refusal);
    },
  });

  return { status: response.status, body: response.body, refusals };
}

describe('a guard that decides on the caller alone', () => {
  const withdraw = only(routes, 'withdrawInvoice');

  it('refuses the anonymous caller with 401 before its body, its params or its query are read', async () => {
    const malformed = await answered(withdraw, post({ invoiceId: 'not-an-id' }, {}), undefined);

    expect(malformed.status).toBe(401);
    expect(malformed.body).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(malformed.body).not.toHaveProperty('issues');
  });

  it('still answers 422 to an authenticated caller that sends a malformed input', async () => {
    expect((await answered(withdraw, post({ invoiceId: INVOICE_ID }, {}), session)).status).toBe(422);

    expect((await answered(withdraw, post({ invoiceId: INVOICE_ID }, { reason: 'duplicate' }), session)).status).toBe(
      204,
    );
  });

  it('refuses with 403 an authenticated caller without the role, before its input is validated', async () => {
    const audit = only(routes, 'auditInvoice');

    expect((await answered(audit, post({ invoiceId: 'not-an-id' }, {}), session)).status).toBe(403);
  });

  it('refuses the anonymous caller of a tenant route with 401, before its path is validated', async () => {
    const lines = only(routes, 'listTenantInvoices');
    const request: RawRequest = { params: { invoiceId: 'not-an-id' }, query: {}, headers: {}, body: undefined, raw: 1 };

    expect((await answered(lines, request, anonymousActor())).status).toBe(401);
    expect((await answered(lines, request, session)).status).toBe(422);
  });

  it('is reported as a refusal at the edge, with who was refused', async () => {
    const { refusals } = await answered(withdraw, post({ invoiceId: 'not-an-id' }, {}), undefined);

    expect(refusals).toHaveLength(1);

    expect(refusals[0]).toMatchObject({
      operationId: 'withdrawInvoice',
      problem: { status: 401, code: 'UNAUTHORIZED' },
      execution: { actor: { type: 'anonymous' } },
    });
  });

  it('is left out with the other guards when a spec skips them', async () => {
    const [skipped] = controllerRoutes([new WithdrawInvoiceController()], { guards: 'skip' });

    expect(skipped?.admit).toBeUndefined();
    expect((await answered(skipped ?? withdraw, post({ invoiceId: INVOICE_ID }, {}), undefined)).status).toBe(422);
  });
});

describe('the declared order of the guards', () => {
  it('keeps a guard of the project that reads the path after validation, and its admission before', async () => {
    const seen: string[] = [];

    const ownsInvoice: Guard = {
      check({ params }) {
        seen.push(`owns ${String(params['invoiceId'])}`);
      },
    };

    const admitting: Guard = {
      admit() {
        seen.push('admit');
      },
      check() {
        seen.push('check');
      },
    };

    class OwnedRoutes {}

    class ArchiveInvoiceController {
      handle(): Promise<void> {
        return Promise.resolve();
      }
    }

    RouteGroup({ prefix: '/owned', guards: [ownsInvoice, admitting] })(OwnedRoutes);

    Controller({
      group: OwnedRoutes,
      method: 'POST',
      path: '/:invoiceId/archive',
      summary: 'Archive invoice',
      params: invoiceParams,
      response: { status: 204 },
    })(ArchiveInvoiceController);

    const [archive] = controllerRoutes([new ArchiveInvoiceController()]);
    const request = post({ invoiceId: INVOICE_ID }, undefined);

    expect((await answered(archive ?? only(routes, 'withdrawInvoice'), request, session)).status).toBe(204);
    expect(seen).toEqual(['admit', `owns ${INVOICE_ID}`, 'check']);
  });

  it('does not report a guard that fails in its admission as a refusal', async () => {
    const failing: Guard = {
      admit: () => Promise.reject(new Error('directory down')),
      check: () => undefined,
    };

    class FailingRoutes {}

    class PeekController {
      handle(): Promise<void> {
        return Promise.resolve();
      }
    }

    RouteGroup({ prefix: '/failing', guards: [failing] })(FailingRoutes);

    Controller({ group: FailingRoutes, method: 'GET', path: '/', summary: 'Peek', response: { status: 204 } })(
      PeekController,
    );

    const [peek] = controllerRoutes([new PeekController()]);
    const request: RawRequest = { params: {}, query: {}, headers: {}, body: undefined, raw: undefined };
    const { status, refusals } = await answered(peek ?? only(routes, 'withdrawInvoice'), request, session);

    expect(status).toBe(500);
    expect(refusals).toEqual([]);
  });

  it('refuses through the admission of a route declared by hand', async () => {
    const route: Route = {
      method: 'GET',
      path: '/reports',
      operationId: 'readReports',
      summary: 'Read reports',
      security: ['bearer'],
      responses: { 204: { description: 'Done.' } },
      admit() {
        throw new ForbiddenError('Reports are closed');
      },
      handle: () => ({ status: 204 }),
    };

    const request: RawRequest = { params: {}, query: {}, headers: {}, body: undefined, raw: undefined };
    const { status, refusals } = await answered(route, request, session);

    expect(status).toBe(403);
    expect(refusals).toHaveLength(1);
  });
});

describe.each([
  ['Express', onExpress],
  ['Fastify', onFastify],
  ['Hono', onHono],
])('an anonymous caller of a guarded route, on %s', (_name, start) => {
  let server: RunningServer;
  let received = 0;

  beforeAll(async () => {
    const mounted = controllerRoutes([new WithdrawInvoiceController(), new AttachReceiptController()]);
    const reader = multipartUploads();

    // Counts the uploads read: none from a caller refused on who it is.
    const uploads: UploadReader = (spec, request) => {
      received += 1;

      return reader(spec, request);
    };

    server = await start(mounted, { uploads, resolvePrincipal: () => undefined });
  });

  afterAll(() => server.close());

  it('gets 401 for a malformed body, with no validation issue', async () => {
    const response = await fetch(`${server.url}/invoices/not-an-id/withdrawal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    const problem: unknown = await response.json();

    expect(response.status).toBe(401);
    expect(problem).not.toHaveProperty('issues');
  });

  it('gets 401 for an upload, and the upload is never read', async () => {
    const data = new FormData();

    data.set('title', 'Taxi receipt');
    data.set('document', new Blob(['%PDF-1.7\n%%EOF\n'], { type: 'application/pdf' }), 'receipt.pdf');

    const response = await fetch(`${server.url}/invoices/receipts`, { method: 'POST', body: data });

    expect(response.status).toBe(401);
    expect(received).toBe(0);
  });
});
