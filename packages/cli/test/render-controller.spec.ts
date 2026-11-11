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

  it('keeps what else the route imported from the auth package, actorOf left out', () => {
    const kept = renderController({
      route: {
        ...route,
        imports: [...route.imports.slice(0, 1), "import { actorOf, sessionOf } from '@ddd-ts-kit/auth';\n"],
      },
      types,
      group,
      body: BODY,
      groupImport: "import { InvoicesRoutes } from '../invoices.routes';",
    });

    expect(kept).toContain("import { sessionOf } from '@ddd-ts-kit/auth';");
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

  const named = (errors: string, kernel: string): string =>
    renderController({
      route: { ...route, imports: [...route.imports, kernel], spec: new Map([...route.spec, ['errors', errors]]) },
      types,
      group,
      body: BODY,
      groupImport: "import { InvoicesRoutes } from '../invoices.routes';",
    });

  it('leaves out the codes of the kit its guard and its group say when the route named them by the list of the kit, and the import with them', () => {
    const typed = named(
      '[KitCodes.Unauthorized, KitCodes.Forbidden]',
      "import { KitCodes, type QueryBus } from '@ddd-ts-kit/kernel';\n",
    );

    expect(typed).toContain('  errors: [],');
    expect(typed).toContain("import type { QueryBus } from '@ddd-ts-kit/kernel';");
    expect(typed).not.toContain('KitCodes');

    const valued = named(
      "[KitCodes.Unauthorized, 'INVOICE_LOCKED']",
      "import { err, KitCodes, ok, type QueryBus } from '@ddd-ts-kit/kernel';\n",
    );

    expect(valued).toContain("  errors: ['INVOICE_LOCKED'],");
    expect(valued).toContain("import { err, ok, type QueryBus } from '@ddd-ts-kit/kernel';");
  });

  it('keeps a code of the kit neither its guard nor its group says, with the import of the list', () => {
    const kept = named(
      '[KitCodes.Unauthorized, KitCodes.Forbidden, KitCodes.Conflict, Other.code]',
      "import { KitCodes, type QueryBus } from '@ddd-ts-kit/kernel';\n",
    );

    expect(kept).toContain('  errors: [KitCodes.Conflict, Other.code],');
    expect(kept).toContain("import { KitCodes, type QueryBus } from '@ddd-ts-kit/kernel';");
  });
});
