import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK } from '../helpers';
import { EditedProject } from './edited-project';
import { bin, runIn } from './run-in';
import { SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';

const BILLING = 'src/contexts/billing';
const AGGREGATE = `${BILLING}/domain/aggregates/ledger.aggregate.ts`;
const CODEC = `${BILLING}/infrastructure/persistence/ledger-events.mapper.ts`;
const BUILDER = `${BILLING}/test/builders/ledger.builder.ts`;
const SPEC = `${BILLING}/test/unit/ledger.aggregate.spec.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const PROJECTION = 'src/contexts/shipping/application/projections/invoices-to-ship.projection.ts';
const TO_STATE = '  toState(): LedgerState {\n    return { ...this.state };';
/** The default stack with the event store the aggregate is saved through. */
const EVENT_SOURCED = { ...DEFAULT_STACK, 'event-sourcing': 'on' };

interface Injection {
  readonly rule: string;
  readonly what: string;
  readonly file: string;
  readonly from: string;
  readonly to: string;
}

/** One violation of each rule of event-sourced aggregates, written into what the generator gave. */
const INJECTIONS: readonly Injection[] = [
  {
    rule: 'event-sourcing/state-in-apply',
    what: 'a method that writes the state outside an apply method',
    file: AGGREGATE,
    from: TO_STATE,
    to: '  toState(): LedgerState {\n    this.state = { ...this.state };\n\n    return { ...this.state };',
  },
  {
    rule: 'event-sourcing/past-tense',
    what: 'an event named as a command',
    file: AGGREGATE,
    from: "import { LedgerCredited } from '@/contexts/billing/domain/events/ledger-credited.event';",
    to: "import { LedgerCredited } from '@/contexts/billing/domain/events/ledger-credited.event';\nimport type { CreditLedger } from '@/contexts/billing/domain/events/credit-ledger.event';",
  },
  {
    rule: 'event-sourcing/store-behind-repository',
    what: 'a command handler given the event store',
    file: HANDLER,
    from: 'import ',
    to: "import { EventStore } from '@ddd-ts-kit/kernel';\nimport ",
  },
  {
    rule: 'event-sourcing/projection-never-appends',
    what: 'a projection given the event store',
    file: PROJECTION,
    from: 'import ',
    to: "import { EventStore } from '@ddd-ts-kit/kernel';\nimport ",
  },
  {
    rule: 'event-sourcing/upcaster-required',
    what: 'a stored event raised to version 2 without its upcaster',
    file: CODEC,
    from: 'defineStoredEvent(LedgerCredited, {\n    version: 1,',
    to: 'defineStoredEvent(LedgerCredited, {\n    version: 2,',
  },
];

/** Slow, opt-in (DDD_TS_KIT_E2E=1): the generated event-sourced aggregate, installed as published, against both analyzers. */
describe.runIf(SLOW)('an event-sourced aggregate as generated', () => {
  let project: EditedProject;

  beforeAll(() => {
    project = EditedProject.generate((root) => {
      cli(
        root,
        'generate',
        'aggregate',
        'billing',
        'Ledger',
        '--event-sourced',
        '--term',
        'Ledger=The payments of a customer',
        '--term',
        'Create=To open',
      );

      cli(root, 'generate', 'domain-event', 'billing', 'Ledger', 'Credited', '--term', 'Credit=To add money');
      cli(root, 'generate', 'projection', 'shipping', 'InvoicesToShip', 'billing.invoice.issued');
    }, EVENT_SOURCED);
  }, 240_000);

  afterEach(() => {
    project.restore();
  });

  it('type-checks as generated, once a second event has extended the aggregate and its codec', () => {
    const compiled = runIn(project.root, {
      command: process.execPath,
      args: [NATIVE_COMPILER, '-p', 'tsconfig.json', '--noEmit'],
    });

    expect(compiled).toBe('');
  }, 120_000);

  it('passes the specs it generated: the given-events spec of the aggregate and the specs of its events', () => {
    const specs = runIn(project.root, { command: bin('vitest'), args: ['run', `${BILLING}/test/unit/ledger`] });

    // ledger.aggregate.spec.ts, ledger-created.event.spec.ts and ledger-credited.event.spec.ts.
    expect(specs).toMatch(/Test Files\s+3 passed \(3\)/);
  }, 120_000);

  it('passes the checker and ESLint as generated', () => {
    expect(project.checkedRules()).toEqual([]);
    expect(project.linted(AGGREGATE, CODEC, BUILDER, SPEC, PROJECTION)).toBe('');
  }, 120_000);

  it.each(INJECTIONS)(
    'both analyzers catch $what ($rule)',
    ({ rule, file, from, to }) => {
      project.edit(file, from, to);

      expect(project.checkedRules()).toContain(rule);
      expect(project.linted(file)).toContain(`ddd-ts-kit/${rule.replace('/', '-')}`);
    },
    120_000,
  );
});
