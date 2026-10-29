import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';
const COMMAND = `${BILLING}/application/commands/refund-invoice/refund-invoice.command.ts`;
const FOLDER = `${BILLING}/presentation/http/invoices/refund-invoice`;
const CONTROLLER = `${FOLDER}/refund-invoice.controller.ts`;
const SPEC = `${BILLING}/test/unit/refund-invoice.controller.spec.ts`;
const ENDPOINT = ['--method', 'POST', '--path', '/invoices/:invoiceId/refund'];

const FIELDS = [
  'actor: Actor',
  'readonly invoiceId: string',
  'readonly reason: string',
  'readonly refundAmount: number',
  'readonly notifyCustomer: boolean',
];

const SENT = "body: { reason: 'reason-1', refundAmount: 1, notifyCustomer: true }";

const EXPECTED =
  "expect(commands.executed).toEqual([new RefundInvoiceCommand(caller, 'invoice-id-1', 'reason-1', 1, true)]);";

/** A project of the stack, the command of a refund generated, then its constructor filled as a team fills it. */
function refundIn(flags: readonly string[], fields: readonly string[] = FIELDS): string {
  const root = initProject('--context', 'billing:core', ...flags);

  const generated = cli(
    root,
    'generate',
    'command',
    'billing',
    'RefundInvoice',
    '--permission',
    'invoice.refund',
    '--allow-name',
  );

  expect(generated.code, generated.stderr).toBe(0);

  write(root, COMMAND, commandSource('RefundInvoiceCommand', fields));

  return root;
}

function commandSource(className: string, fields: readonly string[]): string {
  return [
    "import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';",
    '',
    `export class ${className} extends AuthorizedCommand {`,
    '  constructor(',
    ...fields.map((field) => `    ${field},`),
    '  ) {',
    '    super(actor);',
    '  }',
    '}',
    '',
  ].join('\n');
}

function route(root: string, ...flags: readonly string[]): void {
  const result = cli(root, 'generate', 'route', 'billing', 'RefundInvoice', ...ENDPOINT, ...flags);

  expect(result.code, result.stderr).toBe(0);
}

describe('generate route after a command whose constructor declares its fields, on zod', () => {
  let root: string;

  beforeAll(() => {
    root = refundIn(['--validation', 'zod']);
    route(root);
  });

  it('writes the body schema of the fields the path does not carry, and the call that hands each field over', () => {
    const controller = read(root, CONTROLLER);

    expect(controller).toContain(
      'z.object({\n    reason: z.string(),\n    refundAmount: z.number(),\n    notifyCustomer: z.boolean(),\n  }),',
    );

    expect(controller).toContain('request.actor,\n        request.params.invoiceId,\n        request.body.reason,');
    expect(controller).not.toContain('TODO(domain): build the command');
    expect(controller).not.toContain('TODO(domain): declare the fields the client sends');
  });

  it('writes a spec that sends a valid body and asserts the command the use case is handed', () => {
    const spec = read(root, SPEC);

    expect(spec).toContain(SENT);
    expect(spec).toContain(EXPECTED);
  });
});

describe('generate route after a command whose fields it cannot all read', () => {
  it('reads the fields up to the first of another type and leaves the rest to a TODO, in the schema and in the call', () => {
    const root = refundIn(
      ['--validation', 'zod'],
      [
        'actor: Actor',
        'readonly invoiceId: string',
        'readonly reason: string',
        'readonly period: BillingPeriod',
        'readonly note?: string',
      ],
    );

    route(root);

    const controller = read(root, CONTROLLER);

    expect(controller).toContain(
      '    reason: z.string(),\n    // TODO(domain): declare what the client sends for `period` (BillingPeriod), `note` (string, optional)',
    );

    expect(controller).toContain(
      'new RefundInvoiceCommand(request.actor, request.params.invoiceId, request.body.reason)',
    );

    expect(controller).toContain('TODO(domain): build the command from `request` (body, params)');
  });

  it('leaves the message to the request mapper when the route has one', () => {
    const root = refundIn(['--validation', 'zod']);

    route(root, '--mapper');

    expect(read(root, CONTROLLER)).toContain('this.mapper.map(request)');
    expect(read(root, CONTROLLER)).toContain('TODO(domain): declare the fields the client sends');
    expect(read(root, SPEC)).toContain('expect(commands.executed).toEqual([new RefundInvoiceCommand(caller)]);');
  });
});

describe('generate route after a command whose constructor declares its fields, on class-validator', () => {
  it('declares each field in the body class with its decorator, validates the class as it is, and hands each field over', () => {
    const root = refundIn(['--validation', 'class-validator']);

    route(root);

    expect(read(root, `${FOLDER}/refund-invoice.body.ts`)).toBe(
      [
        "import { IsBoolean, IsNumber, IsString } from 'class-validator';",
        '',
        'export class RefundInvoiceBody {',
        '  @IsString()',
        "  reason = '';",
        '',
        '  @IsNumber()',
        '  refundAmount = 0;',
        '',
        '  @IsBoolean()',
        '  notifyCustomer = false;',
        '}',
        '',
      ].join('\n'),
    );

    expect(read(root, CONTROLLER)).toContain('const body = classSchema(RefundInvoiceBody);\n');
    expect(read(root, CONTROLLER)).toContain('request.params.invoiceId,');
    expect(read(root, SPEC)).toContain(EXPECTED);
  });
});

describe('generate route after a command whose constructor declares its fields, on TypeBox', () => {
  it('declares each field in the object of the body', () => {
    const root = refundIn(['--http', 'fastify', '--validation', 'typebox']);

    route(root);

    expect(read(root, CONTROLLER)).toContain(
      'Type.Object({\n    reason: Type.String(),\n    refundAmount: Type.Number(),\n    notifyCustomer: Type.Boolean(),\n  }),',
    );

    expect(read(root, SPEC)).toContain(SENT);
  });
});

describe('generate route after a command whose constructor declares its fields, on Standard Schema', () => {
  it('writes a schema of the path parameters and of the body by hand, the protocol being all the stack names, and their JSON Schema', () => {
    const root = refundIn(['--validation', 'standard-schema']);

    route(root);

    const controller = read(root, CONTROLLER);

    expect(controller).toContain('interface RefundInvoiceParams {\n  readonly invoiceId: string;\n}');
    expect(controller).toContain("      if (typeof sent.refundAmount !== 'number') {");
    expect(controller).toContain("  required: ['reason', 'refundAmount', 'notifyCustomer'],");
    expect(controller).toContain('  params,\n  body,\n');
    expect(controller).toContain('HttpRequest<{ params: Infer<typeof params>; body: Infer<typeof body> }>');
    expect(controller).not.toContain('anyObject');
    expect(read(root, SPEC)).toContain(EXPECTED);
  });
});

describe('generate route after a command or a query whose constructor declares its fields, written as functions', () => {
  it('hands each field of the input over, and a query reads its fields from the path', () => {
    const root = refundIn(['--validation', 'zod', '--routes', 'functions']);

    const query = cli(
      root,
      'generate',
      'query',
      'billing',
      'InvoiceTotal',
      '--permission',
      'invoice.total',
      '--allow-name',
    );

    expect(query.code, query.stderr).toBe(0);

    write(
      root,
      `${BILLING}/application/queries/invoice-total/invoice-total.query.ts`,
      commandSource('InvoiceTotalQuery', ['actor: Actor', 'readonly invoiceId: string'])
        .replaceAll('AuthorizedCommand', 'AuthorizedQuery')
        .replace('extends AuthorizedQuery {', 'extends AuthorizedQuery<InvoiceTotalResult> {')
        .replace(
          "import { AuthorizedQuery, type Actor } from '@ddd-ts-kit/kernel';",
          "import { AuthorizedQuery, type Actor } from '@ddd-ts-kit/kernel';\nimport type { InvoiceTotalResult } from './invoice-total.result';",
        ),
    );

    route(root);

    const total = cli(
      root,
      'generate',
      'route',
      'billing',
      'InvoiceTotal',
      '--method',
      'GET',
      '--path',
      '/invoices/:invoiceId/total',
    );

    expect(total.code, total.stderr).toBe(0);
    expect(read(root, `${BILLING}/presentation/http/refund-invoice.route.ts`)).toContain('input.body.notifyCustomer');

    expect(read(root, `${BILLING}/presentation/http/invoice-total.route.ts`)).toContain(
      'new InvoiceTotalQuery(actorOf(input.context.principal), input.params.invoiceId)',
    );

    expect(read(root, `${BILLING}/test/unit/invoice-total.route.spec.ts`)).toContain(
      "expect(queries.executed).toEqual([new InvoiceTotalQuery(caller, 'invoice-id-1')]);",
    );
  });
});

describe('generate route after a command whose constructor declares its fields, on Nest', () => {
  it('declares the fields in the body class Nest validates and hands the parameters of the method over', () => {
    const root = refundIn(['--http', 'nest', '--di', 'nest', '--validation', 'class-validator']);

    route(root);

    expect(read(root, CONTROLLER)).toContain(
      'new RefundInvoiceCommand(actor, params.invoiceId, body.reason, body.refundAmount, body.notifyCustomer)',
    );

    expect(read(root, `${FOLDER}/refund-invoice.body.ts`)).toContain('  @IsNumber()\n  refundAmount = 0;');
    expect(read(root, SPEC)).toContain(EXPECTED);
  });
});
