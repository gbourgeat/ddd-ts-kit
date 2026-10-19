import { beforeAll, describe, expect, it } from 'vitest';
import { cli, EXPLICIT_STACK, exists, read, scaffoldEverything, tempDir, write, type CliResult } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { readJson } from './support/read-json.js';
import { stringsAt } from './support/strings-at.js';

const HTTP = 'src/contexts/billing/presentation/http';
const FUNCTIONS = ['--routes', 'functions'];
const COMPOSITION = 'src/platform/composition/compose-application.ts';

describe('controllers, on a declared project of function routes', () => {
  let root: string;
  let outcome: CliResult;

  beforeAll(() => {
    root = tempDir('codemod');
    scaffoldEverything(root, { ...EXPLICIT_STACK, style: 'declared', validation: 'class-validator' }, FUNCTIONS);
    outcome = cli(root, 'controllers', '--json');
  });

  it('turns every context whole and says what it moved', () => {
    expect(outcome.code).toBe(0);
    expect(stringsAt(outcome.json(), 'contexts')).toEqual(['billing', 'order-fulfilment']);
    expect(stringsAt(outcome.json(), 'blockers')).toEqual([]);

    expect(stringsAt(outcome.json(), 'moved')).toContain(
      'issue-invoice.route.ts -> invoices/issue-invoice/issue-invoice.controller.ts',
    );

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack', 'routes')).toBe('controllers');
  });

  it('writes each controller behind the group of its resource, with what its route declared', () => {
    const controller = read(root, `${HTTP}/invoices/cancel-invoice/cancel-invoice.controller.ts`);

    expect(controller).toContain("group: InvoicesRoutes,\n  method: 'DELETE',\n  path: '/:invoiceId',");

    expect(controller).toContain(
      'export class CancelInvoiceController {\n  constructor(private readonly commands: CommandBus) {}',
    );

    expect(controller).toContain(
      'async handle(request: HttpRequest<{ params: CancelInvoiceParams }>): Promise<void> {',
    );

    expect(controller).toContain('await this.commands.execute(new CancelInvoiceCommand(request.actor));');
    expect(controller).not.toContain('actorOf');
    expect(controller).not.toContain("'UNAUTHORIZED'");

    expect(read(root, `${HTTP}/invoices.routes.ts`)).toContain(
      "@RouteGroup({ prefix: '/invoices', tags: ['billing'], guards: [Authenticated], errors: ['FORBIDDEN'] })",
    );
  });

  it('keeps a public route public, outside any group, and names a page by the class of its lines', () => {
    const track = read(
      root,
      'src/contexts/order-fulfilment/presentation/http/purchase-orders/track-purchase-order/track-purchase-order.controller.ts',
    );

    expect(track).toContain("tags: ['order-fulfilment'],\n  guards: [Public],");
    expect(track).toContain("path: '/purchase-orders/:purchaseOrderId/tracking',");

    expect(read(root, `${HTTP}/invoices/search-invoices/search-invoices.controller.ts`)).toContain(
      'Promise<PageBody<SearchInvoicesLine>>',
    );
  });

  it('moves the schema files and the spec with the route, and removes the list of a declared context', () => {
    expect(exists(root, `${HTTP}/invoices/issue-invoice/issue-invoice.body.ts`)).toBe(true);
    expect(exists(root, `${HTTP}/issue-invoice-body.dto.ts`)).toBe(false);
    expect(exists(root, `${HTTP}/issue-invoice.route.ts`)).toBe(false);
    expect(exists(root, `${HTTP}/billing.routes.ts`)).toBe(false);

    expect(read(root, 'src/contexts/billing/test/unit/issue-invoice.controller.spec.ts')).toContain(
      "controllerRoute(new IssueInvoiceController(commands), { guards: 'skip' })",
    );

    expect(read(root, 'src/platform/composition/compose-application.ts')).not.toContain('billingRoutes');
    expect(stringsAt(outcome.json(), 'manual').join('\n')).not.toContain('Mount the declared controllers');
  });

  it('leaves a project that passes its checks once its generated files are refreshed', () => {
    expect(cli(root, 'docs').code).toBe(0);
    expect(cli(root, 'check').stdout).toContain('0 errors');
    expect(cli(root, 'controllers').stdout).toBe('Nothing to do: no function route was found.');
  });
});

describe('controllers, where it stops', () => {
  it('lists a controller built by hand where an explicit context listed its route', () => {
    const root = tempDir('codemod-explicit');

    scaffoldEverything(root, EXPLICIT_STACK, FUNCTIONS);

    const report = cli(root, 'controllers', 'order-fulfilment', '--dry-run');

    expect(report.stdout).toContain('would move    place-purchase-order.route.ts');
    expect(exists(root, 'src/contexts/order-fulfilment/presentation/http/place-purchase-order.route.ts')).toBe(true);
    expect(cli(root, 'controllers', 'order-fulfilment').code).toBe(0);

    expect(read(root, 'src/contexts/order-fulfilment/presentation/http/order-fulfilment.routes.ts')).toContain(
      '...controllerRoutes([new PlacePurchaseOrderController(commands)]),',
    );

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack', 'routes')).toBe('functions');
  });

  it('turns no route of a context when one cannot be turned, and says which and why', () => {
    const root = initProject(...FUNCTIONS, '--context', 'billing:core');

    const route = (handler: string, responses = "{ 204: { description: 'Done.' } }"): string =>
      `import { defineRoute, type Route } from '@ddd-ts-kit/http';\nimport type { CommandBus } from '@ddd-ts-kit/kernel';\n\nexport function pingRoute(commands: CommandBus): Route {\n  return defineRoute(\n    { method: 'POST', path: '/', operationId: 'ping', summary: 'Ping', responses: ${responses}, security: ['bearer'] },\n    ${handler},\n  );\n}\n`;

    const refused = (source: string): string => {
      write(root, `${HTTP}/ping.route.ts`, source);

      return cli(root, 'controllers').stdout;
    };

    expect(refused('export const pingRoute = 1;\n')).toContain('it is not written as `export function <name>Route(');
    expect(refused(route('(input) => ({ status: 204 })'))).toContain('its handler is not written as `async (input)');

    expect(refused(route('async (input) => {\n      return { status: 204, headers: {} };\n    }'))).toContain(
      'keep it a function',
    );

    expect(
      refused(
        route(
          'async (input) => {\n      return { status: 204 };\n    }',
          "{ 204: { description: 'a' }, 200: { description: 'b' } }",
        ),
      ),
    ).toContain('it declares several responses');

    expect(cli(root, 'controllers').code).toBe(1);
    expect(exists(root, `${HTTP}/billing/ping/ping.controller.ts`)).toBe(false);
    expect(cli(root, 'controllers', 'shipping').code).toBe(2);

    write(
      root,
      `${HTTP}/ping.route.ts`,
      route('async (input) => {\n      await commands.execute(input.body);\n\n      return { status: 204 };\n    }'),
    );

    // A project initialised before controllers existed mounts none: the command says which line to add.
    write(root, COMPOSITION, read(root, COMPOSITION).replace("of('controller')", "of('none')"));

    expect(cli(root, 'controllers').stdout).toContain('Mount the declared controllers');

    expect(read(root, `${HTTP}/billing/ping/ping.controller.ts`)).toContain(
      "group: BillingRoutes,\n  method: 'POST',\n  path: '/',\n  summary: 'Ping',",
    );

    expect(read(root, `${HTTP}/billing.routes.ts`)).toContain('@RouteGroup({ tags: [], guards: [Authenticated] })');
  });
});
