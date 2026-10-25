import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir } from './helpers';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';
const INVOICE = ['--term', 'Invoice=A request for payment'];
const ISSUE = [...INVOICE, '--term', 'Issue=To make an invoice final'];
const DETAILS = [...INVOICE, '--term', 'Details=What an invoice holds', '--term', 'Read=To look at'];
const NEST = ['--http', 'nest', '--di', 'nest', '--validation', 'class-validator', '--routes', 'nest'];

let root: string;

function step(...args: string[]): void {
  const result = cli(root, ...args, '--json');

  if (result.code !== 0) {
    throw new Error(`${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
}

beforeAll(() => {
  root = initProject(...NEST, '--package-manager', 'npm');
  step('generate', 'context', 'billing', '--classification', 'core', '--purpose', 'Bills customers.');
  step('generate', 'aggregate', 'billing', 'Invoice', ...INVOICE);

  step(
    'generate',
    'command',
    'billing',
    'IssueInvoice',
    '--aggregate',
    'Invoice',
    '--permission',
    'invoice.issue',
    ...ISSUE,
  );

  step(
    'generate',
    'route',
    'billing',
    'IssueInvoice',
    '--method',
    'POST',
    '--path',
    '/invoices/:invoiceId/issue',
    ...ISSUE,
  );

  step('generate', 'query', 'billing', 'InvoiceDetails', '--permission', 'invoice.read', ...DETAILS);

  step(
    'generate',
    'route',
    'billing',
    'InvoiceDetails',
    '--method',
    'GET',
    '--path',
    '/invoices/:invoiceId',
    ...DETAILS,
  );
});

describe('generate route under "stack.routes": "nest"', () => {
  it('writes a Nest controller whose method carries @KitRoute, the bus injected by its class', () => {
    const controller = read(root, `${BILLING}/presentation/http/invoices/issue-invoice/issue-invoice.controller.ts`);

    expect(controller).toContain("import { Body, Controller, Inject, Param, Post } from '@nestjs/common';");
    expect(controller).toContain('@KitRoutes({ group: InvoicesRoutes })');
    expect(controller).toContain('constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}');
    expect(controller).toContain("@Post(':invoiceId/issue')");
    expect(controller).toContain('async issueInvoice(');
    expect(controller).not.toContain('operationId');
    expect(controller).toContain('request: { params: paramsSchema, body: bodySchema },');
    expect(controller).toContain('@Param() params: IssueInvoiceParams');
    expect(controller).toContain('@Body() body: IssueInvoiceBody');
    expect(controller).toContain('@CurrentActor() actor: Actor');
    expect(controller).toContain('new IssueInvoiceCommand(actor)');
  });

  it('writes a query as a GET method that injects the query bus and declares its answer', () => {
    const controller = read(
      root,
      `${BILLING}/presentation/http/invoices/invoice-details/invoice-details.controller.ts`,
    );

    expect(controller).toContain("@Get(':invoiceId')");
    expect(controller).toContain('constructor(@Inject(QueryBus) private readonly queries: QueryBus) {}');
    expect(controller).toContain("response: { status: 200, description: 'The answer.', body: answer },");
  });

  it('lists the controllers in the module of the context, for Nest to build them, and builds none itself', () => {
    const module = read(root, `${BILLING}/billing.module.ts`);

    expect(module).toMatch(
      /controllers: \[\n\s+\/\/ ddd-ts-kit:controllers\n\s+IssueInvoiceController,\n\s+InvoiceDetailsController,/,
    );

    expect(module).not.toContain('new IssueInvoiceController');
    expect(module).not.toContain('controllerRoutes');
  });

  it('gives each controller a spec that calls its route through the pipeline of the kit', () => {
    const spec = read(root, `${BILLING}/test/unit/issue-invoice.controller.spec.ts`);

    expect(spec).toContain("import { nestControllerRoute } from '@ddd-ts-kit/http/nest';");
    expect(spec).toContain('instanceOf: () => new IssueInvoiceController(commands),');
  });

  it('has the application hand the controllers to Nest with the buses of the platform', () => {
    expect(read(root, 'src/platform/composition/compose-application.ts')).toContain(
      '{ provide: CommandBus, useValue: platform.commands },',
    );

    expect(read(root, 'src/platform/http/create-app-module.ts')).toContain('provideControllers(controllers)');
  });

  it('says that the method of a Nest controller maps its input itself, when --mapper is given', () => {
    const search = cli(
      root,
      'generate',
      'route',
      'billing',
      'IssueInvoice',
      '--method',
      'POST',
      '--path',
      '/x',
      '--mapper',
      ...ISSUE,
    );

    expect(search.stdout + search.stderr).toContain('--mapper and --serializer are left out');
  });
});

describe('init --routes nest', () => {
  it.each([
    [['--http', 'express', '--validation', 'class-validator'], '--http express and --validation class-validator'],
    [['--http', 'nest', '--di', 'nest', '--validation', 'zod'], '--http nest and --validation zod'],
  ])('is refused outside a Nest project on class-validator (%j)', (flags, said) => {
    const refused = cli(tempDir('init'), 'init', ...flags, '--routes', 'nest');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(`--routes nest writes Nest controllers, and this project has ${said}.`);
  });
});
