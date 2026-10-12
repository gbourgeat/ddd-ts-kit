import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPastParticiple } from '../src/check/event-sourcing/is-past-participle.js';
import { parseConfig } from '../src/config/index.js';
import { writeStoredEventsLock } from '../src/docs/write-stored-events-lock.js';
import { Workspace } from '../src/workspace/index.js';
import { lines, projectWith, reported } from './rules-support.js';

const BILLING = 'src/contexts/billing';
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const CODEC = `${BILLING}/infrastructure/persistence/invoice-events.mapper.ts`;
const LOCK = 'stored-events.lock.json';

const messages = (root: string, rule: string): string[] =>
  reported(root, rule).map(({ line, message }) => `${line} ${message}`);

/** An event-sourced invoice whose method `pay` holds the lines given. */
const invoice = (...pay: string[]): string =>
  lines(
    "import { EventSourcedAggregate } from '@ddd-ts-kit/kernel';",
    "import { InvoicePaid } from '@/contexts/billing/domain/events/invoice-paid.event';",
    'export class Invoice extends EventSourcedAggregate<InvoicePaid> {',
    '  private lines: string[] = [];',
    '  private constructor(id: string) {',
    '    super(id);',
    '    this.lines = [];',
    '  }',
    '  static rehydrate(id: string): Invoice {',
    '    const invoice = new Invoice(id);',
    '    invoice.lines = [];',
    '    return invoice;',
    '  }',
    '  pay(): void {',
    ...pay.map((line) => `    ${line}`),
    '  }',
    '  private applyPaid(): void {',
    "    this.lines.push('paid');",
    '  }',
    '}',
  );

describe('event-sourcing/state-in-apply', () => {
  it('reports every way a command writes the state: assignment, compound, increment, mutating call', () => {
    const root = projectWith({
      [AGGREGATE]: invoice(
        'this.lines = [];',
        'this.count += 1;',
        'this.count++;',
        '--this.count;',
        "this.lines.push('x');",
        'this.state.lines[0] = "y";',
      ),
    });

    expect(messages(root, 'event-sourcing/state-in-apply')).toEqual([
      '15 pay of the event-sourced aggregate Invoice changes its state outside an apply method.',
      '16 pay of the event-sourced aggregate Invoice changes its state outside an apply method.',
      '17 pay of the event-sourced aggregate Invoice changes its state outside an apply method.',
      '18 pay of the event-sourced aggregate Invoice changes its state outside an apply method.',
      '19 pay of the event-sourced aggregate Invoice changes its state outside an apply method.',
      '20 pay of the event-sourced aggregate Invoice changes its state outside an apply method.',
    ]);
  });

  it('leaves comparisons, reads, the constructor, static factories, apply methods and other aggregates alone', () => {
    const root = projectWith({
      [AGGREGATE]: invoice('if (this.lines.length === 0) {', '  this.record(new InvoicePaid(this.id));', '}'),
      [`${BILLING}/domain/aggregates/credit-note.aggregate.ts`]: lines(
        'export class CreditNote extends AggregateRoot {',
        '  cancel(): void {',
        '    this.cancelled = true;',
        '  }',
        '}',
      ),
    });

    expect(messages(root, 'event-sourcing/state-in-apply')).toEqual([]);
  });
});

describe('event-sourcing/past-tense', () => {
  it('knows the regular and the common irregular past participles', () => {
    expect(['issued', 'Taken', 'withdrawn', 'paid', 'held', 'set', 'sent', 'won'].every(isPastParticiple)).toBe(true);
    expect(['issue', 'cancel', 'book', 'show', 'pay'].some(isPastParticiple)).toBe(false);
  });

  it('judges the events of event-sourced aggregates only', () => {
    const root = projectWith({
      [AGGREGATE]: invoice().replace('InvoicePaid }', 'InvoicePaid, PayInvoice }'),
      [`${BILLING}/domain/aggregates/credit-note.aggregate.ts`]: lines(
        "import { CancelCreditNote } from '@/contexts/billing/domain/events/cancel-credit-note.event';",
        'export class CreditNote extends AggregateRoot {}',
      ),
    });

    expect(messages(root, 'event-sourcing/past-tense')).toEqual([
      '2 The event PayInvoice is not named in the past tense.',
    ]);
  });
});

describe('event-sourcing/store-behind-repository', () => {
  it('reports the store in the domain and the use cases, and leaves infrastructure and the composition alone', () => {
    const store = lines("import { EventStore, type SnapshotStore } from '@ddd-ts-kit/kernel';");

    const root = projectWith({
      [`${BILLING}/domain/services/ledger.service.ts`]: store,
      [`${BILLING}/application/queries/invoice-history/invoice-history.handler.ts`]: store,
      [`${BILLING}/infrastructure/persistence/event-store-invoice.repository.ts`]: store,
      [`${BILLING}/billing.module.ts`]: store,
      [`${BILLING}/test/unit/invoice.aggregate.spec.ts`]: store,
    });

    expect(
      reported(root, 'event-sourcing/store-behind-repository').map(({ file, message }) => `${file}: ${message}`),
    ).toEqual([
      `${BILLING}/application/queries/invoice-history/invoice-history.handler.ts: EventStore is named in application/: the use cases never read the event store.`,
      `${BILLING}/application/queries/invoice-history/invoice-history.handler.ts: SnapshotStore is named in application/: the use cases never read the event store.`,
      `${BILLING}/domain/services/ledger.service.ts: EventStore is named in domain/: the domain never reads the event store.`,
      `${BILLING}/domain/services/ledger.service.ts: SnapshotStore is named in domain/: the domain never reads the event store.`,
    ]);
  });
});

describe('event-sourcing/projection-never-appends', () => {
  it('judges a class declared with @Projection wherever it lives', () => {
    const root = projectWith({
      [`${BILLING}/application/event-handlers/invoice-paid.event-handler.ts`]: lines(
        "import { EventSourcedRepository } from '@ddd-ts-kit/kernel';",
        "@Projection('billing.invoice-list')",
        'export class InvoiceList {}',
      ),
    });

    expect(messages(root, 'event-sourcing/projection-never-appends')).toEqual([
      '1 The projection names EventSourcedRepository: it could append to a stream.',
    ]);
  });
});

const codec = (data: string, version: number, upcasters = ''): string =>
  lines(
    `interface InvoicePaidData { ${data} }`,
    'export const invoiceEvents = {',
    "  'billing.invoice.paid': defineStoredEvent(InvoicePaid, {",
    `    version: ${version},`,
    '    encode(event: InvoicePaid): InvoicePaidData {',
    '      return { cents: event.cents };',
    '    },',
    "    decode: (data, envelope) => new InvoicePaid(envelope.aggregateId, data.number('cents')),",
    upcasters,
    '  }),',
    '};',
  );

function lockOf(root: string): unknown {
  const ws = new Workspace(root, false);

  writeStoredEventsLock(
    ws,
    parseConfig(JSON.parse(fs.readFileSync(path.join(root, 'ddd-ts-kit.config.json'), 'utf8'))),
    ['billing'],
  );

  ws.commit(false);

  return fs.existsSync(path.join(root, LOCK)) ? JSON.parse(fs.readFileSync(path.join(root, LOCK), 'utf8')) : undefined;
}

describe('event-sourcing/upcaster-required and the lock of the stored shapes', () => {
  it('records each new version once, and never rewrites a recorded one', () => {
    const root = projectWith({ [CODEC]: codec('readonly cents: number;', 1) });
    const first = lockOf(root);

    fs.writeFileSync(path.join(root, CODEC), codec('readonly cents: number; readonly note: string;', 1));

    expect(lockOf(root)).toEqual(first);

    expect(messages(root, 'event-sourcing/upcaster-required')).toEqual([
      '3 The stored shape of InvoicePaid in version 1 changed.',
    ]);

    fs.writeFileSync(
      path.join(root, CODEC),
      codec('readonly cents: number; readonly note: string;', 2, 'upcasters: { 1: (data) => data },'),
    );

    expect(Object.keys((lockOf(root) as Record<string, object>)['billing.invoice.paid'] ?? {})).toEqual(['1', '2']);
    expect(messages(root, 'event-sourcing/upcaster-required')).toEqual([]);

    fs.writeFileSync(path.join(root, CODEC), codec('readonly cents: number;', 1));

    expect(messages(root, 'event-sourcing/upcaster-required')).toEqual([
      '3 InvoicePaid is declared in version 1, and version 2 is already stored.',
    ]);
  });

  it('writes no lock for a project without stored events, and reads a broken lock as empty', () => {
    const root = projectWith({ [LOCK]: '{ not json' });

    expect(lockOf(projectWith({}))).toBeUndefined();
    expect(messages(root, 'event-sourcing/upcaster-required')).toEqual([]);
  });
});
