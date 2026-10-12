import { shapeFingerprint } from '../event-sourcing/shape-fingerprint.js';
import { STORED_EVENTS_LOCK } from '../event-sourcing/stored-events-lock-file.js';
import { scan } from '../scan/scan.js';
import { aggregate } from './aggregate.js';
import type { Fixture } from './fixture.js';
import type { FixtureFiles } from './fixture-files.js';
import { handler } from './handler.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { source } from './source.js';

const { AGGREGATE, BILLING, EVENT, HANDLER } = PATHS;

const STATE = 'event-sourcing/state-in-apply';
const PAST = 'event-sourcing/past-tense';
const STORE = 'event-sourcing/store-behind-repository';
const PROJECTION_RULE = 'event-sourcing/projection-never-appends';
const UPCASTER = 'event-sourcing/upcaster-required';

const KERNEL = "'@ddd-ts-kit/kernel'";
const ISSUED_EVENT = "import { InvoiceIssued } from '@/contexts/billing/domain/events/invoice-issued.event.js';";
const PRESENT_EVENT = `${BILLING}/domain/events/issue-invoice.event.ts`;
const CODEC = `${BILLING}/infrastructure/persistence/invoice-events.mapper.ts`;
const PROJECTION = `${BILLING}/application/projections/invoice-list.projection.ts`;
const STORE_ADAPTER = `${BILLING}/infrastructure/persistence/event-store-invoice.repository.ts`;

const EVENTS: FixtureFiles = {
  [EVENT]: source(
    "export class InvoiceIssued {\n  readonly name = 'billing.invoice.issued';\n\n  constructor(\n    readonly aggregateId: string,\n    readonly amount: number,\n  ) {}\n}",
  ),
  [PRESENT_EVENT]: source(
    "export class IssueInvoice {\n  readonly name = 'billing.invoice.issued';\n\n  constructor(readonly aggregateId: string) {}\n}",
  ),
};

const RECORDING = ['this.record(new InvoiceIssued(this.id, amount));'];
const APPLYING = ['this.amount = event.amount;'];

const STATE_IN_APPLY: readonly Fixture[] = [
  {
    ruleId: STATE,
    name: 'a command that records, an apply method and a restore that write the state',
    expect: 'pass',
    files: project({ ...EVENTS, ...invoice(RECORDING, APPLYING) }),
  },
  {
    ruleId: STATE,
    name: 'a command that writes the state of an event-sourced aggregate itself',
    expect: { file: AGGREGATE },
    files: project({ ...EVENTS, ...invoice(['this.amount += amount;', ...RECORDING], APPLYING) }),
  },
  {
    ruleId: STATE,
    name: 'an apply method that records an event',
    expect: { file: AGGREGATE },
    files: project({ ...EVENTS, ...invoice(RECORDING, [...APPLYING, 'this.record(event);']) }),
  },
];

const PAST_TENSE: readonly Fixture[] = [
  {
    ruleId: PAST,
    name: 'an event-sourced aggregate recording a fact named in the past tense',
    expect: 'pass',
    files: project({ ...EVENTS, ...invoice(RECORDING, APPLYING) }),
  },
  {
    ruleId: PAST,
    name: 'an event-sourced aggregate recording an event named as a command',
    expect: { file: AGGREGATE },
    files: project({
      ...EVENTS,
      ...invoice(
        ['this.record(new IssueInvoice(this.id));'],
        APPLYING,
        "import { IssueInvoice } from '@/contexts/billing/domain/events/issue-invoice.event.js';",
      ),
    }),
  },
];

const STORE_BEHIND_REPOSITORY: readonly Fixture[] = [
  {
    ruleId: STORE,
    name: 'the event store held by the repository adapter, the handler given the repository',
    expect: 'pass',
    files: project({
      ...handler(
        source(
          "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';",
          '',
          'export class IssueInvoiceHandler {',
          '  constructor(private readonly invoices: InvoiceRepository) {}',
          '}',
        ),
      ),
      [STORE_ADAPTER]: source(
        `import { EventStore } from ${KERNEL};`,
        '',
        'export class EventStoreInvoiceRepository {',
        '  constructor(private readonly store: EventStore) {}',
        '}',
      ),
    }),
  },
  {
    ruleId: STORE,
    name: 'a command handler reading the stream of the aggregate',
    expect: { file: HANDLER },
    files: project(
      handler(
        source(
          `import { EventStore } from ${KERNEL};`,
          '',
          'export class IssueInvoiceHandler {',
          '  constructor(private readonly store: EventStore) {}',
          '}',
        ),
      ),
    ),
  },
];

const LIST_PORT = "import { InvoiceList } from '@/contexts/billing/application/ports/invoice-list.port.js';";

const PROJECTION_NEVER_APPENDS: readonly Fixture[] = [
  {
    ruleId: PROJECTION_RULE,
    name: 'a projection writing its read model only',
    expect: 'pass',
    files: project(projection([LIST_PORT], ['private readonly invoices: InvoiceList'])),
  },
  {
    ruleId: PROJECTION_RULE,
    name: 'a projection given the event store',
    expect: { file: PROJECTION },
    also: [STORE],
    files: project(
      projection(
        [LIST_PORT, `import { EventStore } from ${KERNEL};`],
        ['private readonly invoices: InvoiceList', 'private readonly store: EventStore'],
      ),
    ),
  },
  {
    ruleId: PROJECTION_RULE,
    name: 'a projection given a repository',
    expect: { file: PROJECTION },
    files: project(
      projection(
        ["import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';"],
        ['private readonly invoices: InvoiceRepository'],
      ),
    ),
  },
];

const AMOUNT = 'readonly amount: number;';
const ENCODE = 'encode: (event): InvoiceIssuedData => ({ amount: event.amount }),';
const UPCAST = 'upcasters: { 1: (data) => ({ amount: 0, ...data }) },';

const UPCASTER_REQUIRED: readonly Fixture[] = [
  {
    ruleId: UPCASTER,
    name: 'version 2 read through the upcaster from version 1, its shape as recorded',
    expect: 'pass',
    files: project({
      ...EVENTS,
      [CODEC]: codec(AMOUNT, ['version: 2,', ENCODE, UPCAST]),
      ...locked({ 1: fingerprintOf('readonly cents: number;'), 2: fingerprintOf(`\n  ${AMOUNT}  `) }),
    }),
  },
  {
    ruleId: UPCASTER,
    name: 'version 2 without the upcaster from version 1',
    expect: { file: CODEC },
    files: project({ ...EVENTS, [CODEC]: codec(AMOUNT, ['version: 2,', ENCODE]) }),
  },
  {
    ruleId: UPCASTER,
    name: 'a field added to the shape of a recorded version',
    expect: { file: CODEC },
    files: project({
      ...EVENTS,
      [CODEC]: codec(`${AMOUNT}\n  readonly currency: string;`, ['version: 1,', ENCODE]),
      ...locked({ 1: fingerprintOf(AMOUNT) }),
    }),
  },
  {
    ruleId: UPCASTER,
    name: 'an encode that names no stored type',
    expect: { file: CODEC },
    files: project({
      ...EVENTS,
      [CODEC]: codec(AMOUNT, ['version: 1,', 'encode: (event) => ({ amount: event.amount }),']),
    }),
  },
];

export const EVENT_SOURCING_FIXTURES: readonly Fixture[] = [
  ...STATE_IN_APPLY,
  ...PAST_TENSE,
  ...STORE_BEHIND_REPOSITORY,
  ...PROJECTION_NEVER_APPENDS,
  ...UPCASTER_REQUIRED,
];

/** An event-sourced invoice whose `issue` command and `applyIssued` method are the lines given. */
function invoice(command: readonly string[], apply: readonly string[], event = ISSUED_EVENT): FixtureFiles {
  return aggregate(
    source(
      `import { EventSourcedAggregate, type Appliers } from ${KERNEL};`,
      event,
      '',
      'export class Invoice extends EventSourcedAggregate<InvoiceIssued> {',
      '  private amount = 0;',
      '',
      '  private constructor(id: string) {',
      '    super(id);',
      '  }',
      '',
      '  issue(amount: number): void {',
      ...command.map((line) => `    ${line}`),
      '  }',
      '',
      '  protected appliers(): Appliers<InvoiceIssued> {',
      "    return { 'billing.invoice.issued': (event) => this.applyIssued(event) };",
      '  }',
      '',
      '  private applyIssued(event: InvoiceIssued): void {',
      ...apply.map((line) => `    ${line}`),
      '  }',
      '',
      '  private restore(amount: number): void {',
      '    this.amount = amount;',
      '  }',
      '}',
    ),
  );
}

function projection(imports: readonly string[], parameters: readonly string[]): FixtureFiles {
  return {
    [PROJECTION]: source(
      ...imports,
      '',
      'export class InvoiceListProjection {',
      `  constructor(${parameters.join(', ')}) {}`,
      '}',
    ),
    [`${BILLING}/test/unit/invoice-list.projection.spec.ts`]: source(
      "import { it } from 'vitest';",
      '',
      "it.todo('lists');",
    ),
    [`${BILLING}/application/ports/invoice-list.port.ts`]: 'export abstract class InvoiceList {}\n',
  };
}

/** The codec of the invoice: its data, then the entry of `billing.invoice.issued` with what the fixture declares. */
function codec(data: string, entry: readonly string[]): string {
  return source(
    `import { defineStoredEvent } from ${KERNEL};`,
    ISSUED_EVENT,
    '',
    `interface InvoiceIssuedData {\n  ${data}\n}`,
    '',
    'export const invoiceEvents = {',
    "  'billing.invoice.issued': defineStoredEvent(InvoiceIssued, {",
    ...entry.map((line) => `    ${line}`),
    "    decode: (data, { aggregateId }) => new InvoiceIssued(aggregateId, data.number('amount')),",
    '  }),',
    '};',
  );
}

function fingerprintOf(data: string): string {
  return shapeFingerprint(scan(codec(data, [])), 'InvoiceIssuedData') ?? '';
}

function locked(versions: Readonly<Record<string, string>>): FixtureFiles {
  return { [STORED_EVENTS_LOCK]: `${JSON.stringify({ 'billing.invoice.issued': versions }, null, 2)}\n` };
}
