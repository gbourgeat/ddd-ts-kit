import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { readNestControllers } from '../src/nest-controllers/read-nest-controllers';
import { renderControllersFile } from '../src/nest-controllers/render-controllers-file';

const CONFIG = parseConfig({
  importExtension: 'none',
  stack: { http: 'nest', di: 'nest', validation: 'class-validator', routes: 'nest' },
  contexts: { billing: { classification: 'core' } },
});

const FOLDER = 'src/contexts/billing/presentation/http/invoices';

const CONTROLLER = `import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import type { Accepted } from '@ddd-ts-kit/http';
import { CurrentActor, KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { IssuedInvoice } from '@/contexts/billing/presentation/http/invoices/issued-invoice';
import type { InvoiceLine } from '@/contexts/billing/presentation/http/invoices/invoice-line';
import { IssueInvoiceBody } from '@/contexts/billing/presentation/http/invoices/issue-invoice-body';

@Controller('invoices')
@KitRoutes({ guards: [] })
export class InvoicesController {
  constructor(private readonly ledger: object) {}

  @Post(':invoiceId/issue')
  async issueInvoice(
    @Param('invoiceId') invoiceId: string,
    @Body() body: IssueInvoiceBody,
    @CurrentActor() actor: Actor,
  ): Promise<IssuedInvoice> {
    return new IssuedInvoice();
  }

  @Post()
  async create(@Body() body: { reason: string }, @Query() query: Record<string, string>): Promise<Accepted> {
    return { id: '1' };
  }

  @Get('lines')
  lines(): Promise<InvoiceLine[]> {
    return Promise.resolve([]);
  }

  @Get('total')
  total(): { total: number } {
    return { total: 1 };
  }

  @Get('line')
  async line(): Promise<InvoiceLine> {
    return { sku: 'a' };
  }

  @Post(':invoiceId/void')
  async voidInvoice(): Promise<void> {}

  @Get('untyped')
  async untyped() {
    return 1;
  }

  @Get('declared')
  @KitRoute({ request: { headers }, response: { body: declared } })
  async declaredAnswer(@Headers() signed: Record<string, string>): Promise<InvoiceLine[]> {
    return [];
  }

  helper(): string {
    return 'not a route';
  }
}
`;

const FILES: Readonly<Record<string, string>> = {
  [`${FOLDER}/invoices.controller.ts`]: CONTROLLER,
  [`${FOLDER}/issued-invoice.ts`]: 'export class IssuedInvoice {}\n',
  [`${FOLDER}/invoice-line.ts`]: 'export interface InvoiceLine {\n  sku: string;\n}\n',
  [`${FOLDER}/issue-invoice-body.ts`]: 'export class IssueInvoiceBody {}\n',
  [`${FOLDER}/invoices.controller.spec.ts`]: CONTROLLER.replace('InvoicesController', 'SpecController'),
  // A module of the context keeps its presentation in its own folder.
  ['src/contexts/billing/ledger/presentation/http/entries/entries.controller.ts']: CONTROLLER.replace(
    'InvoicesController',
    'EntriesController',
  ),
};

const files = {
  read: (file: string) => FILES[file],
  under: (directory: string) => Object.keys(FILES).filter((file) => file.startsWith(`${directory}/`)),
};

describe('the Nest controllers of a context, read from their sources', () => {
  const controller = readNestControllers(files, CONFIG, 'billing').find(
    ({ className }) => className === 'InvoicesController',
  );

  it('finds the route methods of a controller the kit serves, and what each signature answers', () => {
    expect(controller?.className).toBe('InvoicesController');
    expect(controller?.specifier).toBe('@/contexts/billing/presentation/http/invoices/invoices.controller');

    expect(Object.fromEntries(controller?.methods.map(({ name, answer }) => [name, answer]) ?? [])).toEqual({
      issueInvoice: {
        kind: 'class',
        name: 'IssuedInvoice',
        specifier: '@/contexts/billing/presentation/http/invoices/issued-invoice',
      },
      create: { kind: 'accepted' },
      lines: { kind: 'unread', text: 'Promise<InvoiceLine[]>' },
      total: { kind: 'unread', text: '{ total: number }' },
      line: { kind: 'unread', text: 'Promise<InvoiceLine>' },
      voidInvoice: { kind: 'none' },
      untyped: { kind: 'unread', text: 'no return type' },
      declaredAnswer: { kind: 'unread', text: 'Promise<InvoiceLine[]>' },
    });
  });

  it('reads the parts of the request a parameter takes whole, and knows those @KitRoute gives', () => {
    expect(Object.fromEntries(controller?.methods.map(({ name, request }) => [name, request]) ?? [])).toMatchObject({
      issueInvoice: [
        {
          source: 'body',
          type: {
            kind: 'class',
            name: 'IssueInvoiceBody',
            specifier: '@/contexts/billing/presentation/http/invoices/issue-invoice-body',
          },
          declared: false,
        },
      ],
      create: [
        { source: 'body', type: { kind: 'unread', text: '{ reason: string }' }, declared: false },
        { source: 'query', type: { kind: 'unread', text: 'Record<string, string>' }, declared: false },
      ],
      declaredAnswer: [{ source: 'headers', type: { kind: 'unread' }, declared: true }],
      voidInvoice: [],
    });
  });

  it('knows a method whose @KitRoute says its body, and reads the modules of the context but not the specs', () => {
    expect(controller?.methods.filter(({ declaresResponse }) => declaresResponse).map(({ name }) => name)).toEqual([
      'declaredAnswer',
    ]);

    expect(readNestControllers(files, CONFIG, 'billing').map(({ className }) => className)).toEqual([
      'EntriesController',
      'InvoicesController',
    ]);
  });

  it('writes the list with what it read, a method it could not read left to @KitRoute or the checker', () => {
    const written = renderControllersFile(
      'billing',
      'billingControllers',
      controller === undefined ? [] : [controller],
    );

    expect(written).toContain("import { acceptedSchema } from '@ddd-ts-kit/http';");

    expect(written).toContain(
      "import { IssuedInvoice } from '@/contexts/billing/presentation/http/invoices/issued-invoice';",
    );

    expect(written).toContain(
      "import { IssueInvoiceBody } from '@/contexts/billing/presentation/http/invoices/issue-invoice-body';",
    );

    expect(written).toContain(
      [
        '  withSignatures(InvoicesController, {',
        '    issueInvoice: { body: IssueInvoiceBody, answer: IssuedInvoice },',
        '    create: { answer: acceptedSchema },',
        '    voidInvoice: { answer: null },',
        '  }),',
      ].join('\n'),
    );
  });

  it('writes the members of a method on their own lines when they do not fit on one', () => {
    const body = `${'A'.repeat(100)}Body`;

    const rendered = renderControllersFile('billing', 'billingControllers', [
      {
        file: `${FOLDER}/invoices.controller.ts`,
        className: 'InvoicesController',
        specifier: '@/contexts/billing/presentation/http/invoices/invoices.controller',
        methods: [
          {
            name: 'issueInvoice',
            line: 1,
            request: [{ source: 'body', type: { kind: 'class', name: body, specifier: '@/bodies' }, declared: false }],
            answer: { kind: 'none' },
            declaresResponse: false,
          },
        ],
      },
    ]);

    expect(rendered).toContain(`    issueInvoice: {\n      body: ${body},\n      answer: null,\n    },\n  }),`);
  });
});

describe('a DTO a Nest controller imports by a relative path', () => {
  const file = `${FOLDER}/relative.controller.ts`;

  const files = {
    read: (asked: string) => (asked === file ? RELATIVE : undefined),
    under: () => [file],
  };

  it('cannot be read: the kit resolves the aliases of the project alone', () => {
    const [controller] = readNestControllers(files, CONFIG, 'billing');

    expect(controller?.methods.map(({ request }) => request)).toEqual([
      [{ source: 'body', type: { kind: 'unread', text: 'Dto' }, declared: false }],
    ]);
  });
});

const RELATIVE = `import { Body, Controller, Post } from '@nestjs/common';
import { KitRoutes } from '@ddd-ts-kit/http/nest';
import { Dto } from './dto';

@Controller('relative')
@KitRoutes({ guards: [] })
export class RelativeController {
  @Post()
  async create(@Body() body: Dto): Promise<void> {}
}
`;
