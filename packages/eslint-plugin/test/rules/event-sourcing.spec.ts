import { eventSourcingPastTense } from '../../src/rules/event-sourcing-past-tense';
import { eventSourcingProjectionNeverAppends } from '../../src/rules/event-sourcing-projection-never-appends';
import { eventSourcingStateInApply } from '../../src/rules/event-sourcing-state-in-apply';
import { eventSourcingStoreBehindRepository } from '../../src/rules/event-sourcing-store-behind-repository';
import { eventSourcingUpcasterRequired } from '../../src/rules/event-sourcing-upcaster-required';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const HANDLER = `${BILLING}/application/commands/pay-invoice/pay-invoice.handler.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/event-store-invoice.repository.ts`;
const PROJECTION = `${BILLING}/application/projections/invoice-list.projection.ts`;
const CODEC = `${BILLING}/infrastructure/persistence/invoice-events.mapper.ts`;

const invoice = (pay: string, apply = 'this.amount = event.amount;'): string => `
  export class Invoice extends EventSourcedAggregate<InvoicePaid> {
    private amount = 0;
    private constructor(id: string) { super(id); this.amount = 0; }
    static rehydrate(id: string): Invoice { const invoice = new Invoice(id); invoice.amount = 1; return invoice; }
    pay(amount: number): void { ${pay} }
    protected appliers(): Appliers<InvoicePaid> { return { 'billing.invoice.paid': (event) => this.applyPaid(event) }; }
    private applyPaid(event: InvoicePaid): void { ${apply} }
    private restore(amount: number): void { this.amount = amount; }
  }`;

ruleTester.run('event-sourcing-state-in-apply', eventSourcingStateInApply, {
  valid: [
    at(AGGREGATE, invoice('if (this.amount === amount) { return; } this.record(new InvoicePaid(this.id, amount));')),
    at(AGGREGATE, 'export class Invoice extends AggregateRoot { pay(): void { this.paid = true; } }'),
    at(`${BILLING}/test/unit/invoice.aggregate.spec.ts`, invoice('this.amount = amount;')),
  ],
  invalid: [
    {
      ...at(AGGREGATE, invoice('this.amount += amount; this.lines.push(amount); this.count++;')),
      errors: [
        { messageId: 'outsideApply', data: { method: 'pay', className: 'Invoice', target: 'this.amount' } },
        { messageId: 'outsideApply', data: { method: 'pay', className: 'Invoice', target: 'this.lines' } },
        { messageId: 'outsideApply', data: { method: 'pay', className: 'Invoice', target: 'this.count' } },
      ],
    },
    {
      ...at(AGGREGATE, invoice('this.record(new InvoicePaid(this.id, amount));', 'this.record(event);')),
      errors: [{ messageId: 'recordedInApply', data: { method: 'applyPaid', className: 'Invoice' } }],
    },
  ],
});

ruleTester.run('event-sourcing-past-tense', eventSourcingPastTense, {
  valid: [
    at(
      AGGREGATE,
      "import { InvoicePaid } from '@/contexts/billing/domain/events/invoice-paid.event';\nexport class Invoice extends EventSourcedAggregate<InvoicePaid> {}",
    ),
    at(
      AGGREGATE,
      "import { PayInvoice } from '@/contexts/billing/domain/events/pay-invoice.event';\nexport class Invoice extends AggregateRoot {}",
    ),
    at(
      AGGREGATE,
      "import { InvoicePriceSet } from '@/contexts/billing/domain/events/invoice-price-set.event';\nexport class Invoice extends EventSourcedAggregate<InvoicePriceSet> {}",
    ),
    at(HANDLER, "import { PayInvoice } from '@/contexts/billing/domain/events/pay-invoice.event';"),
  ],
  invalid: [
    {
      ...at(
        AGGREGATE,
        "import { PayInvoice } from '@/contexts/billing/domain/events/pay-invoice.event';\nexport class Invoice extends EventSourcedAggregate<PayInvoice> {}",
      ),
      errors: [{ messageId: 'presentTense', data: { name: 'PayInvoice' } }],
    },
    {
      ...at(
        `${BILLING}/domain/aggregates/scheduled-visit.aggregate.ts`,
        "import { ScheduledVisitCancel } from '@/contexts/billing/domain/events/scheduled-visit-cancel.event';\nexport class ScheduledVisit extends EventSourcedAggregate<ScheduledVisitCancel> {}",
      ),
      errors: [{ messageId: 'presentTense', data: { name: 'ScheduledVisitCancel' } }],
    },
    {
      ...at(
        AGGREGATE,
        "import { SetPrice } from '@/contexts/billing/domain/events/set-price.event';\nexport class Invoice extends EventSourcedAggregate<SetPrice> {}",
      ),
      errors: [{ messageId: 'presentTense', data: { name: 'SetPrice' } }],
    },
    {
      ...at(
        AGGREGATE,
        "import { InvoicePaid as PayInvoice } from '@/contexts/billing/domain/events/invoice-paid.event';\nexport class Invoice extends EventSourcedAggregate<PayInvoice> {}",
      ),
      errors: [{ messageId: 'presentTense', data: { name: 'PayInvoice' } }],
    },
  ],
});

ruleTester.run('event-sourcing-store-behind-repository', eventSourcingStoreBehindRepository, {
  valid: [
    at(ADAPTER, "import { EventSourcedRepository, EventStore } from '@ddd-ts-kit/kernel';"),
    at(HANDLER, "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';"),
    at(`${BILLING}/billing.module.ts`, "import { EventStore } from '@ddd-ts-kit/kernel';"),
  ],
  invalid: [
    {
      ...at(HANDLER, "import { EventStore, type CheckpointStore, Clock } from '@ddd-ts-kit/kernel';"),
      errors: [
        { messageId: 'store', data: { name: 'EventStore', layer: 'application' } },
        { messageId: 'store', data: { name: 'CheckpointStore', layer: 'application' } },
      ],
    },
    {
      ...at(`${BILLING}/domain/services/ledger.service.ts`, "import { EventSerializer } from '@ddd-ts-kit/kernel';"),
      errors: [{ messageId: 'store', data: { name: 'EventSerializer', layer: 'domain' } }],
    },
  ],
});

ruleTester.run('event-sourcing-projection-never-appends', eventSourcingProjectionNeverAppends, {
  valid: [
    at(PROJECTION, "import { stampOf } from '@ddd-ts-kit/kernel';\nexport class InvoiceListProjection {}"),
    at(HANDLER, "import { EventStore } from '@ddd-ts-kit/kernel';\nexport class PayInvoiceHandler {}"),
    at(
      PROJECTION,
      "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';\n@Projection('billing.invoice-list')\nexport class InvoiceListProjection {}",
    ),
    at(
      'src/platform/events/projector.ts',
      "import { EventStore } from '@ddd-ts-kit/kernel';\nexport class Projector {}",
    ),
  ],
  invalid: [
    {
      ...at(PROJECTION, "import { EventStore } from '@ddd-ts-kit/kernel';\nexport class InvoiceListProjection {}"),
      errors: [{ messageId: 'appends', data: { name: 'EventStore' } }],
    },
    {
      ...at(
        `${BILLING}/application/event-handlers/invoice-paid.event-handler.ts`,
        "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';\n@Projection('billing.invoice-list', { feed: 'event-store' })\nexport class InvoiceList {}",
      ),
      errors: [{ messageId: 'appends', data: { name: 'InvoiceRepository' } }],
    },
  ],
});

const codec = (encode: string, version = 1, upcasters = ''): string => `
  interface InvoicePaidData { readonly cents: number }
  export const invoiceEvents = {
    'billing.invoice.paid': defineStoredEvent(InvoicePaid, { version: ${version}, ${encode}, decode, ${upcasters} }),
  };`;

const reaching = (field: string): string => `
  type Currency = 'EUR' | 'USD';
  interface Paged<T> { readonly items: readonly T[] }
  interface LineData extends Paged<number> { readonly currency: Currency; readonly note: PersonalValue | null }
  interface InvoicePaidData { readonly ${field}; readonly at: Date }
  export const invoiceEvents = {
    'billing.invoice.paid': defineStoredEvent(InvoicePaid, { version: 1, encode: (event): InvoicePaidData => event.paid, decode }),
  };`;

ruleTester.run('event-sourcing-upcaster-required', eventSourcingUpcasterRequired, {
  valid: [
    at(CODEC, codec('encode: (event): InvoicePaidData => ({ cents: event.cents })')),
    at(CODEC, reaching('lines: readonly LineData[]')),
    at(
      CODEC,
      codec('encode(event: InvoicePaid): InvoicePaidData { return { cents: 1 }; }', 3, "upcasters: { 1: up, '2': up }"),
    ),
    at(
      CODEC,
      "enum Status { Open = 'open' }\ninterface InvoicePaidData { readonly status: Status }\nexport const invoiceEvents = { 'billing.invoice.paid': defineStoredEvent(InvoicePaid, { version: 1, encode: (event): InvoicePaidData => ({ status: Status.Open }), decode }) };",
    ),
  ],
  invalid: [
    {
      ...at(CODEC, codec('encode: (event) => ({ cents: event.cents })')),
      errors: [{ messageId: 'unnamed', data: { eventClass: 'InvoicePaid' } }],
    },
    {
      ...at(CODEC, codec('encode: (event): Elsewhere => ({ cents: event.cents })')),
      errors: [{ messageId: 'undeclared', data: { eventClass: 'InvoicePaid', type: 'Elsewhere' } }],
    },
    {
      ...at(CODEC, reaching('slot: Readonly<Record<string, SlotData>>')),
      errors: [
        { messageId: 'unresolved', data: { eventClass: 'InvoicePaid', type: 'InvoicePaidData', name: 'SlotData' } },
      ],
    },
    {
      ...at(
        CODEC,
        codec('encode: function (event): InvoicePaidData { return { cents: 1 }; }', 3, 'upcasters: { 2: up }'),
      ),
      errors: [{ messageId: 'missingUpcaster', data: { eventClass: 'InvoicePaid', version: '3', from: '1' } }],
    },
  ],
});
