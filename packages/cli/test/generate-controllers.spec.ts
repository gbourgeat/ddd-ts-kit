import { beforeAll, describe, expect, it } from 'vitest';
import { cli, EXPLICIT_STACK, exists, read, scaffoldEverything, tempDir } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { readJson } from './support/read-json.js';

const HTTP = 'src/contexts/billing/presentation/http';
const ISSUE = `${HTTP}/invoices/issue-invoice/issue-invoice`;

describe('a route of a new project', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('controllers');
    scaffoldEverything(root);
  });

  it('is a controller class in a folder of its own, behind the group of its resource', () => {
    const controller = read(root, `${ISSUE}.controller.ts`);

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack', 'routes')).toBe('controllers');
    expect(controller).toContain("@Controller({\n  group: InvoicesRoutes,\n  method: 'POST',\n  path: '/',");

    expect(controller).toContain(
      'export class IssueInvoiceController {\n  constructor(private readonly commands: CommandBus) {}',
    );

    expect(controller).toContain(
      'async handle(request: HttpRequest<{ body: Infer<typeof body> }>): Promise<Accepted> {',
    );

    expect(controller).toContain(
      "import { acceptedSchema, Controller, type Accepted, type HttpRequest } from '@ddd-ts-kit/http';",
    );

    expect(controller).toContain("description: 'Done; the body carries the identifier.', body: acceptedSchema },");
    expect(controller).not.toContain('const accepted');

    expect(controller).toContain('new IssueInvoiceCommand(request.actor)');
    expect(controller).not.toContain('security');

    expect(read(root, `${HTTP}/invoices.routes.ts`)).toContain(
      "@RouteGroup({ prefix: '/invoices', tags: ['billing'], guards: [Authenticated], errors: ['FORBIDDEN'] })\nexport class InvoicesRoutes {}",
    );
  });

  it('takes the rest of its path from the prefix of its group, and stands alone when its use case is public', () => {
    const cancel = read(root, `${HTTP}/invoices/cancel-invoice/cancel-invoice.controller.ts`);

    const track = read(
      root,
      'src/contexts/order-fulfilment/presentation/http/purchase-orders/track-purchase-order/track-purchase-order.controller.ts',
    );

    expect(cancel).toContain("path: '/:invoiceId',");
    expect(track).toContain("tags: ['order-fulfilment'],\n  guards: [Public],");
    expect(track).toContain("path: '/purchase-orders/:purchaseOrderId/tracking',");
    expect(track).toContain('async handle(): Promise<');
  });

  it('is described with its whole path, its group, its guards and the permission of its use case', () => {
    const routes = jsonAt(cli(root, 'describe', 'billing', '--json').json(), 'routes');

    expect(routes).toContainEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/invoices',
        operationId: 'issueInvoice',
        group: 'InvoicesRoutes',
        guards: ['Authenticated'],
        useCase: 'IssueInvoice',
        permission: 'invoice.issue',
        request: [{ part: 'body', schema: 'body' }],
        responses: [{ status: 201, schema: 'acceptedSchema' }],
        errors: ['UNAUTHORIZED', 'FORBIDDEN'],
      }),
    );

    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain(
      '| Method | Path | Operation | Group | Guards | Use case | Permission | Request | Responses | Errors |',
    );

    expect(read(root, 'src/contexts/billing/CONTEXT.md')).toContain(
      '| DELETE | `/invoices/:invoiceId` | `cancelInvoice` | `InvoicesRoutes` | `Authenticated` | `CancelInvoice` |',
    );
  });

  it('is driven by its end-to-end spec through its whole path', () => {
    expect(read(root, 'test/e2e/issue-invoice.e2e.spec.ts')).toContain("post('/invoices'");
  });
});

describe('generate route with a mapper or a serializer', () => {
  const useCase = (root: string): void => {
    cli(root, 'generate', 'query', 'billing', 'GetInvoice', '--permission', 'invoice.get', '--allow-name');
    cli(root, 'generate', 'command', 'billing', 'VoidInvoice', '--permission', 'invoice.void', '--allow-name');
  };

  it('write a mapper and a serializer when asked, as declared classes the controller is given', () => {
    const root = initProject('--validation', 'class-validator', '--context', 'billing:core');
    const at = `${HTTP}/invoices`;

    useCase(root);

    cli(
      root,
      'generate',
      'route',
      'billing',
      'GetInvoice',
      '--method',
      'GET',
      '--path',
      '/invoices/:id',
      '--serializer',
    );

    cli(
      root,
      'generate',
      'route',
      'billing',
      'VoidInvoice',
      '--method',
      'POST',
      '--path',
      '/invoices/:id/void',
      '--mapper',
    );

    expect(read(root, `${at}/get-invoice/get-invoice.serializer.ts`)).toContain(
      '@Serializer()\nexport class GetInvoiceSerializer implements Serializer<GetInvoiceResult, GetInvoiceAnswer> {',
    );

    expect(read(root, `${at}/void-invoice/void-invoice.mapper.ts`)).toMatch(
      /@RequestMapper\(\)\nexport class VoidInvoiceMapper\s+implements RequestMapper<HttpRequest<\{ params: VoidInvoiceParams; body: VoidInvoiceBody \}>, VoidInvoiceCommand>/,
    );

    expect(read(root, `${at}/void-invoice/void-invoice.controller.ts`)).toContain(
      'this.commands.execute(this.mapper.map(request))',
    );

    expect(exists(root, `${at}/void-invoice/void-invoice.params.ts`)).toBe(true);

    expect(read(root, 'src/contexts/billing/billing.declarations.ts')).toContain(
      'injected(VoidInvoiceController, [CommandBus, VoidInvoiceMapper]);',
    );
  });
});

describe('generate route-group and guard, and a controller next to function routes', () => {
  const useCase = (root: string): void => {
    cli(root, 'generate', 'query', 'billing', 'GetInvoice', '--permission', 'invoice.get', '--allow-name');
    cli(root, 'generate', 'command', 'billing', 'VoidInvoice', '--permission', 'invoice.void', '--allow-name');
  };

  it('write a group that refines another, a guard with its spec, and refuse a path outside the prefix of its group', () => {
    const root = initProject('--context', 'billing:core');

    useCase(root);
    cli(root, 'generate', 'route-group', 'billing', 'Invoices', '--prefix', '/invoices');

    cli(
      root,
      'generate',
      'group',
      'billing',
      'InvoiceAdmin',
      '--group',
      'Invoices',
      '--prefix',
      '/admin',
      '--role',
      'admin',
    );

    cli(root, 'generate', 'guard', 'billing', 'OfficeHours');

    const outside = cli(
      root,
      'generate',
      'route',
      'billing',
      'VoidInvoice',
      '--method',
      'POST',
      '--path',
      '/voids',
      '--group',
      'InvoiceAdmin',
    );

    const missing = cli(
      root,
      'generate',
      'route',
      'billing',
      'VoidInvoice',
      '--method',
      'POST',
      '--path',
      '/voids',
      '--group',
      'Nowhere',
    );

    const inside = cli(
      root,
      'generate',
      'route',
      'billing',
      'VoidInvoice',
      '--method',
      'POST',
      '--path',
      '/invoices/admin/voids',
      '--group',
      'InvoiceAdmin',
    );

    expect(read(root, `${HTTP}/invoice-admin.routes.ts`)).toContain(
      "@RouteGroup({ parent: InvoicesRoutes, prefix: '/admin', guards: [HasRole(Role.Admin)] })\nexport class InvoiceAdminRoutes {}",
    );

    expect(read(root, `${HTTP}/invoice-admin.routes.ts`)).toContain("import { Role } from '@/platform/auth/role';");
    expect(read(root, 'src/platform/auth/role.ts')).toContain("  Admin: 'admin',\n");

    expect(read(root, `${HTTP}/guards/office-hours.guard.ts`)).toContain(
      '@Guard()\nexport class OfficeHoursGuard implements Guard {',
    );

    expect(exists(root, 'src/contexts/billing/test/unit/office-hours.guard.spec.ts')).toBe(true);
    expect(outside.stderr).toContain('is not under the prefix /invoices/admin of the route group InvoiceAdminRoutes');
    expect(missing.stderr).toContain('The route group NowhereRoutes does not exist');
    expect(inside.code).toBe(0);
    expect(read(root, `${HTTP}/invoice-admin/void-invoice/void-invoice.controller.ts`)).toContain("path: '/voids',");
    expect(cli(root, 'generate', 'route-group', 'billing', 'Open', '--public', '--role', 'x').code).toBe(2);
    expect(cli(root, 'generate', 'route-group', 'billing', 'Bad', '--prefix', 'bad/').code).toBe(2);

    expect(
      cli(initProject('--http', 'none', '--context', 'billing:core'), 'generate', 'guard', 'billing', 'Any').code,
    ).toBe(2);
  });

  it('write a controller in a project of function routes, next to them, and keep `route` a function there', () => {
    const root = initProject('--routes', 'functions', '--context', 'billing:core');

    useCase(root);
    cli(root, 'generate', 'controller', 'billing', 'GetInvoice', '--method', 'GET', '--path', '/invoices/:id');
    cli(root, 'generate', 'route', 'billing', 'VoidInvoice', '--method', 'POST', '--path', '/invoices/:id/void');

    expect(exists(root, `${HTTP}/invoices/get-invoice/get-invoice.controller.ts`)).toBe(true);
    expect(exists(root, `${HTTP}/void-invoice.route.ts`)).toBe(true);
    expect(read(root, `${HTTP}/billing.routes.ts`)).toContain('voidInvoiceRoute(commands),');
    expect(read(root, 'src/platform/compose-application.ts')).toContain("of('controller')");
  });
});

describe('a controller of an explicit context', () => {
  it('is built by hand in the list of routes on tsyringe, and in the module file of a context wired by hand', () => {
    const listed = tempDir('controllers-explicit');
    const manual = tempDir('controllers-manual');

    scaffoldEverything(listed, EXPLICIT_STACK);
    scaffoldEverything(manual, { ...EXPLICIT_STACK, di: 'manual', style: 'explicit' });

    expect(read(listed, `${HTTP}/billing.routes.ts`)).toContain(
      '...controllerRoutes([new IssueInvoiceController(commands)]),',
    );

    expect(read(manual, 'src/contexts/billing/billing.module.ts')).toContain(
      '...controllerRoutes([new IssueInvoiceController(platform.commands)]),',
    );

    expect(read(listed, 'src/platform/compose-application.ts')).not.toContain('DeclaredEdges');
  });
});

describe('a route of a project whose routes declare their own schemas ("stack.schemas": "per-route")', () => {
  it('answers an identifier with a schema of its own, as before shared schemas', () => {
    const root = initProject('--validation', 'class-validator', '--schemas', 'per-route', '--context', 'billing:core');
    const issue = `${HTTP}/invoices/issue-invoice/issue-invoice`;

    cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--allow-name');

    cli(
      root,
      'generate',
      'command',
      'billing',
      'IssueInvoice',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.issue',
      '--allow-name',
    );

    cli(root, 'generate', 'route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices');

    const controller = read(root, `${issue}.controller.ts`);

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack', 'schemas')).toBe('per-route');
    expect(exists(root, `${issue}.accepted.ts`)).toBe(true);
    expect(controller).toContain('const accepted = classSchema(IssueInvoiceAccepted);');
    expect(controller).toContain('Promise<IssueInvoiceAccepted>');
    expect(controller).not.toContain('acceptedSchema');
  });
});
