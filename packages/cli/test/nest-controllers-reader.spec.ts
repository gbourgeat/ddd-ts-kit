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

const CONTROLLER = `import { Body, Controller, Get, Post } from '@nestjs/common';
import type { Accepted } from '@ddd-ts-kit/http';
import { KitRoute, KitRoutes } from '@ddd-ts-kit/http/nest';
import { IssuedInvoice } from '@/contexts/billing/presentation/http/invoices/issued-invoice';
import type { InvoiceLine } from '@/contexts/billing/presentation/http/invoices/invoice-line';

@Controller('invoices')
@KitRoutes({ guards: [] })
export class InvoicesController {
  constructor(private readonly ledger: object) {}

  @Post(':invoiceId/issue')
  async issueInvoice(
    @Body() body: { reason: string },
  ): Promise<IssuedInvoice> {
    return new IssuedInvoice();
  }

  @Post()
  async create(): Promise<Accepted> {
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
  @KitRoute({ response: { body: declared } })
  async declaredAnswer(): Promise<InvoiceLine[]> {
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
  [`${FOLDER}/invoices.controller.spec.ts`]: CONTROLLER.replace('InvoicesController', 'SpecController'),
};

const files = {
  read: (file: string) => FILES[file],
  under: (directory: string) => Object.keys(FILES).filter((file) => file.startsWith(`${directory}/`)),
};

describe('the Nest controllers of a context, read from their sources', () => {
  const [controller] = readNestControllers(files, CONFIG, 'billing');

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

  it('knows a method whose @KitRoute says its body, and leaves out what is no route and the specs', () => {
    expect(controller?.methods.filter(({ declaresResponse }) => declaresResponse).map(({ name }) => name)).toEqual([
      'declaredAnswer',
    ]);

    expect(readNestControllers(files, CONFIG, 'billing')).toHaveLength(1);
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
      '  withAnswers(InvoicesController, { issueInvoice: IssuedInvoice, create: acceptedSchema, voidInvoice: null }),',
    );
  });
});
