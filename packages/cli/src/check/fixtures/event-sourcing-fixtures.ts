import { readStoredShape } from '../event-sourcing/read-stored-shape';
import { STORED_EVENTS_LOCK } from '../event-sourcing/stored-events-lock-file';
import { scan } from '../scan/scan';
import { aggregate } from './aggregate';
import { contextDoc } from './context-doc';
import { EVENT_SOURCING_PROJECTION_FIXTURES } from './event-sourcing-projection-fixtures';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { handler } from './handler';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';
import { source } from './source';

const { AGGREGATE, BILLING, EVENT, HANDLER } = PATHS;

const STATE = 'event-sourcing/state-in-apply';
const PAST = 'event-sourcing/past-tense';
const STORE = 'event-sourcing/store-behind-repository';
const UPCASTER = 'event-sourcing/upcaster-required';

const KERNEL = "'@ddd-ts-kit/kernel'";
const ISSUED_EVENT = "import { InvoiceIssued } from '@/contexts/billing/domain/events/invoice-issued.event.js';";
const PRESENT_EVENT = `${BILLING}/domain/events/issue-invoice.event.ts`;
const CODEC = `${BILLING}/infrastructure/persistence/invoice-events.mapper.ts`;
const STORE_ADAPTER = `${BILLING}/infrastructure/persistence/event-store-invoice.repository.ts`;

const EVENTS: FixtureFiles = {
  [EVENT]: source(
    "export class InvoiceIssued {\n  static readonly eventName = 'billing.invoice.issued';\n\n  readonly name = InvoiceIssued.eventName;\n\n  constructor(\n    readonly aggregateId: string,\n    readonly amount: number,\n  ) {}\n}",
  ),
  [PRESENT_EVENT]: source(
    "export class IssueInvoice {\n  static readonly eventName = 'billing.invoice.issued';\n\n  readonly name = IssueInvoice.eventName;\n\n  constructor(readonly aggregateId: string) {}\n}",
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

const PRICED_GLOSSARY = `${SAMPLES.GLOSSARY}\n| Price | What an invoice asks. |\n| Set | To give a value. |`;

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
  namedEvent('a command whose verb is spelled like its participle, at the head', 'SetPrice', { file: AGGREGATE }),
  namedEvent('the same participle after the noun, a fact', 'InvoicePriceSet', 'pass'),
];

/** An event-sourced invoice recording an event of this name, declared in `domain/events/`. */
function namedEvent(name: string, eventClass: string, expect: Fixture['expect']): Fixture {
  const file = eventClass.replace(/(?<=[a-z])(?=[A-Z])/g, '-').toLowerCase();
  const imported = `import { ${eventClass} } from '@/contexts/billing/domain/events/${file}.event.js';`;

  return {
    ruleId: PAST,
    name,
    expect,
    files: project(
      {
        [`${BILLING}/domain/events/${file}.event.ts`]: source(
          `export class ${eventClass} {\n  static readonly eventName = 'billing.invoice.price-set';\n\n  readonly name = ${eventClass}.eventName;\n\n  constructor(readonly aggregateId: string) {}\n}`,
        ),
        ...invoice([`this.record(new ${eventClass}(this.id));`], APPLYING, imported),
      },
      { [`${BILLING}/CONTEXT.md`]: contextDoc('core', undefined, PRICED_GLOSSARY) },
    ),
  };
}

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

const AMOUNT = 'readonly amount: number;';
const ENCODE = 'encode: (event): InvoiceIssuedData => ({ amount: event.amount }),';
const UPCAST = 'upcasters: { 1: (data) => ({ amount: 0, ...data }) },';
const LINE = 'readonly line: InvoiceLineData;';
const LINE_DATA = 'interface InvoiceLineData {\n  readonly cents: number;\n}';

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
    name: 'a field added to the shape of a recorded version, the codec keyed by the name its event class declares',
    expect: { file: CODEC },
    files: project({
      ...EVENTS,
      [EVENT]: source(
        "export class InvoiceIssued {\n  static readonly eventName = 'billing.invoice.issued';\n\n  readonly name = InvoiceIssued.eventName;\n\n  constructor(\n    readonly aggregateId: string,\n    readonly amount: number,\n  ) {}\n}",
      ),
      [CODEC]: codec(`${AMOUNT}\n  readonly currency: string;`, ['version: 1,', ENCODE]).replace(
        "'billing.invoice.issued': defineStoredEvent",
        '[InvoiceIssued.eventName]: defineStoredEvent',
      ),
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
  {
    ruleId: UPCASTER,
    name: 'a recorded shape that reaches a type of the file and a sealed value of the kit, both unchanged',
    expect: 'pass',
    files: project({
      ...EVENTS,
      [CODEC]: codec(`${LINE}\n  readonly note: PersonalValue;`, ['version: 1,', ENCODE], LINE_DATA),
      ...locked({ 1: fingerprintOf(`${LINE}\n  readonly note: PersonalValue;`, LINE_DATA) }),
    }),
  },
  {
    ruleId: UPCASTER,
    name: 'a field added to a type of the file that a recorded shape reaches',
    expect: { file: CODEC },
    files: project({
      ...EVENTS,
      [CODEC]: codec(LINE, ['version: 1,', ENCODE], LINE_DATA.replace(/}$/, '  readonly currency: string;\n}')),
      ...locked({ 1: fingerprintOf(LINE, LINE_DATA) }),
    }),
  },
  {
    ruleId: UPCASTER,
    name: 'a stored shape that reaches a type declared in another file',
    expect: { file: CODEC },
    files: project({ ...EVENTS, [CODEC]: codec('readonly line: InvoiceLine;', ['version: 1,', ENCODE]) }),
  },
];

export const EVENT_SOURCING_FIXTURES: readonly Fixture[] = [
  ...STATE_IN_APPLY,
  ...PAST_TENSE,
  ...STORE_BEHIND_REPOSITORY,
  ...EVENT_SOURCING_PROJECTION_FIXTURES,
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

/** The codec of the invoice: its data and the types it declares beside, then the entry of `billing.invoice.issued` with what the fixture declares. */
function codec(data: string, entry: readonly string[], beside = ''): string {
  return source(
    `import { defineStoredEvent, type PersonalValue } from ${KERNEL};`,
    ISSUED_EVENT,
    '',
    `interface InvoiceIssuedData {\n  ${data}\n}`,
    beside,
    '',
    'export const invoiceEvents = {',
    "  'billing.invoice.issued': defineStoredEvent(InvoiceIssued, {",
    ...entry.map((line) => `    ${line}`),
    "    decode: (data, { aggregateId }) => new InvoiceIssued(aggregateId, data.number('amount')),",
    '  }),',
    '};',
  );
}

function fingerprintOf(data: string, beside = ''): string {
  return readStoredShape(scan(codec(data, [], beside)), 'InvoiceIssuedData')?.fingerprint ?? '';
}

function locked(versions: Readonly<Record<string, string>>): FixtureFiles {
  return { [STORED_EVENTS_LOCK]: `${JSON.stringify({ 'billing.invoice.issued': versions }, null, 2)}\n` };
}
