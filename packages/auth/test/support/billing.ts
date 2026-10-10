import { AuthorizedCommand, AuthorizedQuery, Query, type Actor } from '@ddd-ts-kit/kernel';
import { definePermissions } from '../../src/index.js';

export const billingPermissions = definePermissions('billing', {
  'invoice.issue': { description: 'Issue an invoice to a customer' },
  'invoice.read': { description: 'Read invoices' },
  'invoice.void': { description: 'Void an issued invoice' },
});

export const catalogPermissions = definePermissions('catalog', {
  'product.edit': { description: 'Change a product of the catalog' },
});

export class IssueInvoice extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly customerId: string,
  ) {
    super(actor);
  }
}

export class VoidInvoice extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly invoiceId: string,
    readonly tenantId = 'acme',
  ) {
    super(actor);
  }
}

export class SearchInvoices extends AuthorizedQuery<readonly string[]> {}

export class GetCatalog extends Query<readonly string[]> {}

export class ArchiveInvoices extends AuthorizedCommand {}

export const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: ['accountant'], attributes: {} };
export const bob: Actor = { id: 'bob', type: 'user', tenantId: 'acme', roles: ['clerk'], attributes: {} };
export const root: Actor = { id: 'root', type: 'user', roles: ['admin'], attributes: {} };
