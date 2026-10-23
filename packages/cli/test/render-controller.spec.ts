import { describe, expect, it } from 'vitest';
import type { FunctionRoute } from '../src/controllers/function-route';
import type { HandleTypes } from '../src/controllers/handle-types-of';
import { renderController } from '../src/controllers/render-controller';

const BODY = '    return this.queries.execute(new ListInvoicesQuery());';

const route: FunctionRoute = {
  file: 'src/contexts/billing/presentation/http/list-invoices.route.ts',
  kebab: 'list-invoices',
  pascal: 'ListInvoices',
  bus: 'queries',
  busType: 'QueryBus',
  imports: [
    "import { defineRoute, type Route } from '@ddd-ts-kit/http';\n",
    "import { actorOf } from '@ddd-ts-kit/auth';\n",
  ],
  prelude: '',
  input: 'request',
  body: BODY,
  trailer: '',
  spec: new Map([
    ['operationId', "'listAllInvoices'"],
    ['tags', "['billing', 'reports']"],
    ['errors', "['UNAUTHORIZED', 'FORBIDDEN', 'INVOICE_LOCKED']"],
  ]),
};

const types: HandleTypes = {
  parts: [],
  request: 'HttpRequest',
  result: 'void',
  response: 'response: { status: 200 }',
  usesInfer: false,
  usesPageBody: false,
};

const group = {
  kebab: 'invoices',
  className: 'InvoicesRoutes',
  prefix: '/invoices',
  tags: ['billing'],
  errors: ['FORBIDDEN'],
};

describe('the controller written for a function route', () => {
  const controller = renderController({
    route,
    types,
    group,
    body: BODY,
    groupImport: "import { InvoicesRoutes } from '../invoices.routes';",
  });

  it('takes no request when its handler reads none, and imports neither the request nor actorOf', () => {
    expect(controller).toContain('async handle(): Promise<void> {');
    expect(controller).toContain("import { Controller } from '@ddd-ts-kit/http';");
    expect(controller).not.toContain('@ddd-ts-kit/auth');
  });

  it('answers GET at the root of its group when the route named neither, keeping what differs from the group', () => {
    expect(controller).toContain(
      [
        '@Controller({',
        '  group: InvoicesRoutes,',
        "  method: 'GET',",
        "  path: '/',",
        "  operationId: 'listAllInvoices',",
        "  tags: ['billing', 'reports'],",
        '  response: { status: 200 },',
        "  errors: ['INVOICE_LOCKED'],",
        '})',
      ].join('\n'),
    );
  });
});
