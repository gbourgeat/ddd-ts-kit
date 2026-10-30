import 'reflect-metadata';
import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { type Actor, DomainError, ok } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
import { Authenticated } from '../../src';
import { CurrentActor, KitRoute, KitRoutes } from '../../src/nest';

/**
 * A Nest controller as a project writes it, its decorators applied here by calls, in the order
 * TypeScript applies them, with the `design:paramtypes` that `emitDecoratorMetadata` records: the
 * tests of the kit do not compile legacy decorators.
 */
export const LEDGER = Symbol('ledger');

export interface Ledger {
  readonly issued: string[];
}

export class InvoiceAlreadyIssued extends DomainError {
  readonly code = 'INVOICE_ALREADY_ISSUED';
}

export class IssueInvoiceBody {
  declare customerId: string;
}

IsString()(IssueInvoiceBody.prototype, 'customerId');
MinLength(1)(IssueInvoiceBody.prototype, 'customerId');

export class IssuedInvoice {
  declare invoiceId: string;
  declare customerId: string;
  declare issuedBy: string;
}

for (const field of ['invoiceId', 'customerId', 'issuedBy']) {
  IsString()(IssuedInvoice.prototype, field);
}

export class InvoicesController {
  constructor(private readonly ledger: Ledger) {}

  issue(
    invoiceId: string,
    body: IssueInvoiceBody,
    actor: Actor,
  ): { body: IssuedInvoice; headers: { Location: string } } {
    if (this.ledger.issued.includes(invoiceId)) {
      throw new InvoiceAlreadyIssued(`Invoice ${invoiceId} is already issued.`);
    }

    this.ledger.issued.push(invoiceId);

    return {
      body: { invoiceId, customerId: body.customerId, issuedBy: actor.id },
      headers: { Location: `/invoices/${invoiceId}` },
    };
  }

  search(page: string | undefined, reason: string | undefined): { page: string | null; reason: string | null } {
    return { page: page ?? null, reason: reason ?? null };
  }
}

const prototype = InvoicesController.prototype;

/** The answer of a search, written as a plain schema: a project that writes no DTO class gives a schema. */
const SEARCH_ANSWER = customSchema((input) => ok(input), {
  type: 'object',
  properties: { page: { type: ['string', 'null'] }, reason: { type: ['string', 'null'] } },
});

Controller('invoices')(InvoicesController);
KitRoutes({ guards: [Authenticated], tags: ['Invoices'] })(InvoicesController);
Inject(LEDGER)(InvoicesController, undefined, 0);

Reflect.decorate(
  [
    Post(':invoiceId/issue'),
    KitRoute({
      operationId: 'issueInvoice',
      summary: 'Issue an invoice',
      errors: ['INVOICE_ALREADY_ISSUED'],
      response: { body: IssuedInvoice, headers: { Location: 'The URL of the invoice.' } },
    }),
  ],
  prototype,
  'issue',
  { value: prototype.issue },
);

Param('invoiceId')(prototype, 'issue', 0);
Body()(prototype, 'issue', 1);
CurrentActor()(prototype, 'issue', 2);
Reflect.defineMetadata('design:paramtypes', [String, IssueInvoiceBody, Object], prototype, 'issue');

Reflect.decorate(
  [
    Get(),
    KitRoute({ operationId: 'searchInvoices', summary: 'Search the invoices', response: { body: SEARCH_ANSWER } }),
  ],
  prototype,
  'search',
  { value: prototype.search },
);

Query('page')(prototype, 'search', 0);
Headers('X-Reason')(prototype, 'search', 1);
Reflect.defineMetadata('design:paramtypes', [String, String], prototype, 'search');

/** A caller as the authentication of the platform resolves it from the `authorization` header. */
export function callerOf(raw: unknown): Actor | undefined {
  const headers: unknown = typeof raw === 'object' && raw !== null ? Reflect.get(raw, 'headers') : undefined;

  const authorization: unknown =
    typeof headers === 'object' && headers !== null ? Reflect.get(headers, 'authorization') : undefined;

  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return undefined;
  }

  return { id: authorization.slice('Bearer '.length), type: 'user', roles: [], attributes: {} };
}
