import { applicationCommandQuerySeparation } from '../../src/rules/application-command-query-separation.js';
import { applicationHandlerShape } from '../../src/rules/application-handler-shape.js';
import { domainAggregateEncapsulation } from '../../src/rules/domain-aggregate-encapsulation.js';
import { domainNoGenericError } from '../../src/rules/domain-no-generic-error.js';
import { domainValueObjectImmutability } from '../../src/rules/domain-value-object-immutability.js';
import { eventsNameFormat } from '../../src/rules/events-name-format.js';
import { testNoMocks } from '../../src/rules/test-no-mocks.js';
import { at, BILLING, ruleTester } from '../support/rule-tester.js';

const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const ENTITY = `${BILLING}/domain/entities/invoice-line.entity.ts`;
const VALUE_OBJECT = `${BILLING}/domain/value-objects/amount.vo.ts`;
const SERVICE = `${BILLING}/domain/services/invoice-numbering.service.ts`;
const COMMAND_HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const QUERY_HANDLER = `${BILLING}/application/queries/list-invoices/list-invoices.handler.ts`;
const SPEC = `${BILLING}/test/unit/issue-invoice.handler.spec.ts`;
const EVENT = `${BILLING}/domain/events/invoice-issued.event.ts`;
const CONTRACT = `${BILLING}/published-language/invoice-issued.v1.integration-event.ts`;

ruleTester.run('domain-aggregate-encapsulation', domainAggregateEncapsulation, {
  valid: [
    at(
      AGGREGATE,
      `export class Invoice extends AggregateRoot<string> {
        private constructor(id: string, private state: InvoiceState) { super(id); }
        static create(id: string): Invoice { return new Invoice(id, {}); }
        readonly kind = 'invoice';
        #lines: Line[] = [];
        issue(at: Date): void { this.state = { ...this.state, issuedAt: at }; }
        setAside(reason: string): void { this.guard(); this.state = { ...this.state, reason }; }
        get total(): number { return 0; }
      }`,
    ),
    at(ENTITY, 'export class InvoiceLine extends Entity<string> { protected constructor(id: string) { super(id); } }'),
    at(ENTITY, 'export class InvoiceLine extends Entity<string> {}'),
    at(AGGREGATE, 'export abstract class Document { constructor(readonly id: string) {} }'),
    at(SERVICE, 'export class InvoiceNumbering { constructor(public prefix: string) {} }'),
    at(`${BILLING}/test/unit/invoice.aggregate.spec.ts`, 'class Probe { constructor(public value: number) {} }'),
  ],
  invalid: [
    { ...at(AGGREGATE, 'export class Invoice { constructor(readonly id: string) {} }'), errors: [{ messageId: 'publicConstructor', data: { className: 'Invoice' } }] },
    { ...at(AGGREGATE, 'export class Invoice { public constructor() {} }'), errors: [{ messageId: 'publicConstructor' }] },
    { ...at(AGGREGATE, 'export class Invoice { static create(): Invoice { return new Invoice(); } }'), errors: [{ messageId: 'missingConstructor', data: { className: 'Invoice' } }] },
    { ...at(AGGREGATE, 'export class Invoice { private constructor() {} status = "draft"; }'), errors: [{ messageId: 'publicMutableProperty', data: { className: 'Invoice', name: 'status' } }] },
    { ...at(ENTITY, 'export class InvoiceLine { private constructor(public quantity: number) {} }'), errors: [{ messageId: 'publicMutableProperty', data: { className: 'InvoiceLine', name: 'quantity' } }] },
    { ...at(AGGREGATE, 'export class Invoice { private constructor() {} private status = "draft"; setStatus(status: string): void { this.status = status; } }'), errors: [{ messageId: 'setter', data: { className: 'Invoice', name: 'setStatus' } }] },
    { ...at(AGGREGATE, 'export class Invoice { private constructor() {} #status = "draft"; set status(value: string) { this.guard(); this.#status = value; } }'), errors: [{ messageId: 'setter', data: { className: 'Invoice', name: 'status' } }] },
  ],
});

ruleTester.run('domain-value-object-immutability', domainValueObjectImmutability, {
  valid: [
    at(
      VALUE_OBJECT,
      `export class Amount {
        static readonly ZERO = new Amount(0);
        private readonly currency: string = 'EUR';
        private constructor(private readonly cents: number) { this.currency = 'EUR'; }
        add(other: Amount): Amount { const sum = this.cents + other.cents; return new Amount(sum); }
        sorted(): number[] { const copy = [...this.parts]; copy.sort(); return copy; }
        isZero = (): boolean => this.cents === 0;
      }`,
    ),
    at(AGGREGATE, 'export class Invoice { private total = 0; add(): void { this.total += 1; } }'),
  ],
  invalid: [
    { ...at(VALUE_OBJECT, 'export class Amount { private cents = 0; }'), errors: [{ messageId: 'mutableProperty', data: { className: 'Amount', name: 'cents' } }] },
    { ...at(VALUE_OBJECT, 'export class Amount { #cents = 0; }'), errors: [{ messageId: 'mutableProperty', data: { className: 'Amount', name: '#cents' } }] },
    { ...at(VALUE_OBJECT, 'export class Amount { constructor(private cents: number) {} }'), errors: [{ messageId: 'mutableProperty', data: { className: 'Amount', name: 'cents' } }] },
    { ...at(VALUE_OBJECT, 'export class Amount { private readonly cents = 0; set value(cents: number) {} }'), errors: [{ messageId: 'setter', data: { className: 'Amount', name: 'value' } }] },
    { ...at(VALUE_OBJECT, 'export class Amount { private readonly props = { cents: 0 }; add(other: number): void { this.props.cents += other; } }'), errors: [{ messageId: 'mutation', data: { className: 'Amount', target: 'this.props.cents' } }] },
    { ...at(VALUE_OBJECT, 'export class Counter { private readonly count = 0; next(): void { this.count++; } }'), errors: [{ messageId: 'mutation' }] },
    { ...at(VALUE_OBJECT, 'export class Basket { private readonly items: string[] = []; add(item: string): void { this.items.push(item); } }'), errors: [{ messageId: 'mutation', data: { className: 'Basket', target: 'this.items' } }] },
  ],
});

ruleTester.run('domain-no-generic-error', domainNoGenericError, {
  valid: [
    at(AGGREGATE, 'throw new InvoiceAlreadyIssued(this.id);'),
    at(COMMAND_HANDLER, "throw new DomainError('not found');"),
    at(`${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`, "throw new Error('connection lost');"),
    at(SPEC, "throw new Error('unreachable');"),
    at(AGGREGATE, "class Error {}\nthrow new Error('local');"),
    at(AGGREGATE, 'try { run(); } catch (error) { throw error; }'),
  ],
  invalid: [
    { ...at(AGGREGATE, "throw new Error('Invoice already issued');"), errors: [{ messageId: 'generic', data: { context: 'billing' } }] },
    { ...at(COMMAND_HANDLER, "throw Error('not found');"), errors: [{ messageId: 'generic' }] },
    { ...at(VALUE_OBJECT, "if (cents < 0) throw new globalThis.Error('negative');"), errors: [{ messageId: 'generic' }] },
  ],
});

ruleTester.run('application-handler-shape', applicationHandlerShape, {
  valid: [
    at(COMMAND_HANDLER, 'export class IssueInvoiceHandler { constructor(private readonly ids: IdGenerator) {} async execute(command: IssueInvoiceCommand): Promise<string> { return this.next(); } private next(): string { return this.ids.next(); } #audit(): void {} }'),
    at(QUERY_HANDLER, 'class ListInvoicesHandler { execute = async (): Promise<void> => {}; }\nexport { ListInvoicesHandler };\nexport type Row = { id: string };'),
    at(COMMAND_HANDLER, 'export default class IssueInvoiceHandler { execute(): void {} }'),
    at(`${BILLING}/application/event-handlers/invoice-issued.event-handler.ts`, 'export class InvoiceIssuedEventHandler { async handle(): Promise<void> {} }'),
    at(`${BILLING}/presentation/http/issue-invoice.handler.ts`, 'export const handler = 1;'),
  ],
  invalid: [
    { ...at(COMMAND_HANDLER, 'export const issueInvoice = async (): Promise<void> => {};'), errors: [{ messageId: 'noHandler' }] },
    { ...at(COMMAND_HANDLER, 'class IssueInvoiceHandler { execute(): void {} }'), errors: [{ messageId: 'noHandler' }] },
    { ...at(COMMAND_HANDLER, 'export class IssueInvoiceHandler { execute(): void {} }\nexport class CancelInvoiceHandler { execute(): void {} }'), errors: [{ messageId: 'severalClasses', data: { className: 'CancelInvoiceHandler' } }] },
    { ...at(COMMAND_HANDLER, 'export class IssueInvoiceHandler { async handle(): Promise<void> {} }'), errors: [{ messageId: 'missingExecute', data: { className: 'IssueInvoiceHandler' } }, { messageId: 'extraPublicMethod', data: { className: 'IssueInvoiceHandler', name: 'handle' } }] },
    { ...at(QUERY_HANDLER, 'export class ListInvoicesHandler { execute(): void {} count(): number { return 0; } static build(): void {} }'), errors: [{ messageId: 'extraPublicMethod', data: { className: 'ListInvoicesHandler', name: 'count' } }, { messageId: 'extraPublicMethod', data: { className: 'ListInvoicesHandler', name: 'build' } }] },
  ],
});

ruleTester.run('application-command-query-separation', applicationCommandQuerySeparation, {
  valid: [
    at(QUERY_HANDLER, 'export class ListInvoicesHandler { async execute(query: Q): Promise<R> { const seen = new Set<string>(); seen.delete(query.id); return this.reader.read(query); } }'),
    at(COMMAND_HANDLER, 'export class IssueInvoiceHandler { async execute(): Promise<void> { await this.invoices.save(invoice); await this.events.publish(event); } }'),
    at(`${BILLING}/test/unit/list-invoices.handler.spec.ts`, 'class Probe { run(): void { this.repo.save(1); } }'),
  ],
  invalid: [
    { ...at(QUERY_HANDLER, 'export class ListInvoicesHandler { async execute(): Promise<void> { await this.invoices.save(invoice); } }'), errors: [{ messageId: 'mutation', data: { call: 'this.invoices.save', context: 'billing' } }] },
    { ...at(QUERY_HANDLER, 'export class ListInvoicesHandler { async execute(): Promise<void> { await this.#bus.publish(event); this.cache.delete(key); } }'), errors: [{ messageId: 'mutation', data: { call: 'this.#bus.publish', context: 'billing' } }, { messageId: 'mutation' }] },
    { ...at(QUERY_HANDLER, 'export class ListInvoicesHandler { async execute(): Promise<void> { await this.audit.record(entry); } }'), options: [{ mutators: ['record'] }], errors: [{ messageId: 'mutation' }] },
  ],
});

ruleTester.run('test-no-mocks', testNoMocks, {
  valid: [
    at(SPEC, "import { describe, expect, it } from 'vitest';\nconst invoices = new FakeInvoiceRepository();"),
    at(SPEC, 'vi.useFakeTimers();\nvi.setSystemTime(now);'),
    at('test/e2e/issue-invoice.e2e.spec.ts', 'const spy = vi.fn();'),
    at(`${BILLING}/domain/aggregates/invoice.aggregate.ts`, 'const vi = { fn: () => 1 };\nvi.fn();'),
  ],
  invalid: [
    { ...at(SPEC, 'const save = vi.fn();'), errors: [{ messageId: 'mock', data: { what: 'vi.fn' } }] },
    { ...at(SPEC, "vi.mock('../../infrastructure/persistence/drizzle-invoice.repository.js');"), errors: [{ messageId: 'mock', data: { what: 'vi.mock' } }] },
    { ...at(SPEC, "jest.spyOn(repository, 'save');"), errors: [{ messageId: 'mock', data: { what: 'jest.spyOn' } }] },
    { ...at(`${BILLING}/test/fakes/clock.fake.ts`, "import sinon from 'sinon';"), errors: [{ messageId: 'library', data: { name: 'sinon' } }] },
    { ...at(SPEC, "import { mock } from 'vitest-mock-extended';"), errors: [{ messageId: 'library' }] },
    { ...at(`${BILLING}/application/commands/issue-invoice/issue-invoice.handler.spec.ts`, 'const typed = vi.mocked(repository);'), errors: [{ messageId: 'mock' }] },
  ],
});

ruleTester.run('events-name-format', eventsNameFormat, {
  valid: [
    at(EVENT, "export class InvoiceIssued { readonly name = 'billing.invoice.issued'; }"),
    at(EVENT, "export const invoiceMarkedAsOverdue = { name: 'billing.invoice.marked-as-overdue' };"),
    at(CONTRACT, "export const invoiceIssuedV1 = defineIntegrationEvent({ type: 'billing.invoice.issued', version: 1, payload: schema({ type: 'object' }) });"),
    at(CONTRACT, "export const kind = { type: 'invoice' };"),
    at(`${BILLING}/domain/aggregates/invoice.aggregate.ts`, "const column = { name: 'Total' };"),
    at(`${BILLING}/test/unit/invoice-issued.event.spec.ts`, "const event = { name: 'whatever' };"),
  ],
  invalid: [
    { ...at(EVENT, "export class InvoiceIssued { readonly name = 'InvoiceIssued'; }"), errors: [{ messageId: 'format', data: { value: 'InvoiceIssued', context: 'billing' } }] },
    { ...at(EVENT, "export class InvoiceIssued { readonly name: string = 'catalog.invoice.issued'; }"), errors: [{ messageId: 'format' }] },
    { ...at(EVENT, "export const issued = { name: `billing.Invoice.issued` };"), errors: [{ messageId: 'format' }] },
    { ...at(CONTRACT, "export const invoiceIssuedV1 = defineIntegrationEvent({ type: 'invoice-issued', version: 1 });"), errors: [{ messageId: 'format', data: { value: 'invoice-issued', context: 'billing' } }] },
    { ...at(CONTRACT, "export const legacy = { type: 'billing.invoice' };"), errors: [{ messageId: 'format' }] },
    { ...at(CONTRACT, "export class InvoiceIssued { readonly type = 'billing.invoice.issued.v1'; }"), errors: [{ messageId: 'format' }] },
  ],
});
