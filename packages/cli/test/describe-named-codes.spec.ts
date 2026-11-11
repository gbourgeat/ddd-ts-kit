import { describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const BILLING = 'src/contexts/billing';
const HTTP = `${BILLING}/presentation/http`;

const CODES = `export const BillingCodes = {
  UnknownInvoice: 'UNKNOWN_INVOICE',
} as const;

export type BillingCode = (typeof BillingCodes)[keyof typeof BillingCodes];
`;

const SHARED_CODES = `export const SharedKernelCodes = {
  InvalidMoney: 'INVALID_MONEY',
} as const;
`;

/** A group and a controller that name their codes by the members of the code lists, and one code by a string. */
const GROUP = `import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';
import { KitCodes } from '@ddd-ts-kit/kernel';

@RouteGroup({ prefix: '/invoices', tags: ['billing'], guards: [Authenticated], errors: [KitCodes.Forbidden] })
export class InvoicesRoutes {}
`;

const CONTROLLER = `import { Controller } from '@ddd-ts-kit/http';
import { KitCodes } from '@ddd-ts-kit/kernel';
import { BillingCodes } from '@/contexts/billing/billing.codes';
import { SharedKernelCodes } from '@/shared-kernel/shared-kernel.codes';
import { InvoicesRoutes } from '@/contexts/billing/presentation/http/invoices.routes';

@Controller({
  group: InvoicesRoutes,
  method: 'POST',
  path: '/:invoiceId/payments',
  response: { status: 204, description: 'Paid.' },
  errors: [KitCodes.Forbidden, BillingCodes.UnknownInvoice, SharedKernelCodes.InvalidMoney, 'INVOICE_LOCKED', QuotaCodes.Exceeded],
})
export class PayInvoiceController {}
`;

/** A function route naming its codes the same way. */
const ROUTE = `import { defineRoute } from '@ddd-ts-kit/http';
import { KitCodes } from '@ddd-ts-kit/kernel';
import { BillingCodes } from '@/contexts/billing/billing.codes';

export const voidInvoiceRoute = defineRoute(
  { method: 'DELETE', path: '/invoices/:invoiceId', errors: [KitCodes.Unauthorized, KitCodes.Forbidden, BillingCodes.UnknownInvoice], security: ['bearer'] },
  voidInvoice,
);
`;

describe('describe, the codes a route names by the members of a code list', () => {
  it('gives the code each member names, of the list of the context, of the shared kernel and of the kit, and leaves any other entry as written', () => {
    const root = initProject('--context', 'billing:core');

    write(root, `${BILLING}/billing.codes.ts`, CODES);
    write(root, 'src/shared-kernel/shared-kernel.codes.ts', SHARED_CODES);
    write(root, `${HTTP}/invoices.routes.ts`, GROUP);
    write(root, `${HTTP}/invoices/pay-invoice/pay-invoice.controller.ts`, CONTROLLER);
    write(root, `${HTTP}/void-invoice.route.ts`, ROUTE);

    const described = cli(root, 'describe', 'billing', '--json');

    expect(described.code, described.stderr).toBe(0);

    expect(jsonAt(described.json(), 'routes')).toEqual([
      expect.objectContaining({
        path: '/invoices/:invoiceId',
        errors: ['UNAUTHORIZED', 'FORBIDDEN', 'UNKNOWN_INVOICE'],
      }),
      expect.objectContaining({
        path: '/invoices/:invoiceId/payments',
        errors: [
          'UNAUTHORIZED',
          'FORBIDDEN',
          'UNKNOWN_INVOICE',
          'INVALID_MONEY',
          'INVOICE_LOCKED',
          'QuotaCodes.Exceeded',
        ],
      }),
    ]);
  });
});
