import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, read, write } from '../helpers';
import { EditedProject } from './edited-project';
import { bin, runIn } from './run-in';
import { SLOW } from './stacks';
import { NATIVE_COMPILER } from './type-errors';

const BILLING = 'src/contexts/billing';
const AGGREGATE = `${BILLING}/domain/aggregates/ledger.aggregate.ts`;
const CODEC = `${BILLING}/infrastructure/persistence/ledger-events.mapper.ts`;
const BUILDER = `${BILLING}/test/builders/ledger.builder.ts`;
const SPEC = `${BILLING}/test/unit/ledger.aggregate.spec.ts`;
const REPOSITORY = `${BILLING}/infrastructure/persistence/event-store-ledger.repository.ts`;
const FAKE = `${BILLING}/test/fakes/ledger.repository.fake.ts`;
const CONTRACT = `${BILLING}/test/integration/ledger.repository.contract.spec.ts`;
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
      cli(root, 'generate', 'repository', 'billing', 'Ledger');
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

  it('runs the repository contract as generated: the stale-save case pending, the others green', () => {
    const contract = runIn(project.root, {
      command: bin('vitest'),
      args: ['run', `${BILLING}/test/integration/ledger.repository.contract`],
    });

    expect(contract).toMatch(/Tests\s+\d+ passed \|\s*2 todo/);
    expect(contract).not.toMatch(/failed/);
  }, 120_000);

  it('passes the whole contract on the adapter and its fake once a business method and a mutate are added', () => {
    project.edit(
      AGGREGATE,
      '  get registeredAt(): Date {',
      '  credit(now: Date): void {\n    this.record(new LedgerCredited(this.id, now));\n  }\n\n  get registeredAt(): Date {',
    );

    // The apply method of the generated event is empty: the credit has to move the state for the contract to see a change.
    write(
      project.root,
      AGGREGATE,
      read(project.root, AGGREGATE).replace(
        /(private applyCredited\(event: LedgerCredited\): void \{\n)[^\n]*\n/,
        '$1    this.state = { ...this.state, registeredAt: event.occurredAt };\n',
      ),
    );

    write(
      project.root,
      CONTRACT,
      read(project.root, CONTRACT).replace(
        '  // TODO(domain): add `mutate:',
        "  mutate: (changed: Ledger) => changed.credit(new Date('2026-04-01T00:00:00.000Z')),\n  // TODO(domain): add `mutate:",
      ),
    );

    const contract = runIn(project.root, {
      command: bin('vitest'),
      args: ['run', `${BILLING}/test/integration/ledger.repository.contract`],
    });

    expect(contract).toMatch(/Tests\s+14 passed \(14\)/);
  }, 120_000);

  it('passes the checker and ESLint as generated', () => {
    expect(project.checkedRules()).toEqual([]);
    expect(project.linted(AGGREGATE, CODEC, BUILDER, SPEC, PROJECTION, REPOSITORY, FAKE, CONTRACT)).toBe('');
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

/** Slow, opt-in (DDD_TS_KIT_E2E=1): under shared-table tenancy the platform hands the execution scope to the event store. */
describe.runIf(SLOW).each([
  ['drizzle and tsyringe', {}],
  ['knex and the manual composition', { orm: 'knex', di: 'manual' }],
  ['typeorm', { orm: 'typeorm' }],
])('an event-sourced aggregate under shared-table tenancy, on %s', (_name, flags) => {
  let project: EditedProject;

  beforeAll(() => {
    project = EditedProject.generate(
      (root) => {
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
      },
      { ...EVENT_SOURCED, ...flags, tenancy: 'shared-table' },
    );
  }, 240_000);

  it('gives the event store the scope, type-checks, and holds the store to the tenant contract case', () => {
    const wiring = read(project.root, 'src/platform/event-sourcing/create-event-sourcing.ts');

    expect(wiring).toContain('persistence.eventSourcing(');

    expect(
      runIn(project.root, { command: process.execPath, args: [NATIVE_COMPILER, '-p', 'tsconfig.json', '--noEmit'] }),
    ).toBe('');

    const specs = runIn(project.root, {
      command: bin('vitest'),
      args: ['run', 'src/platform/database', `${BILLING}/test/unit/ledger`],
    });

    // The contract file of the platform holds the event store, the tenant case included.
    expect(specs).toMatch(/persistence\.contract\.spec\.ts \(\d+ tests\)/);
    expect(specs).toMatch(/Test Files\s+3 passed \(3\)/);
  }, 240_000);
});

/** The same on a platform wired by hand over knex, with the birth event named after the business. */
describe.runIf(SLOW)('an event-sourced aggregate born as Triggered, wired by hand', () => {
  let project: EditedProject;

  beforeAll(() => {
    project = EditedProject.generate(
      (root) => {
        cli(
          root,
          'generate',
          'aggregate',
          'billing',
          'Incident',
          '--event-sourced',
          '--birth',
          'Triggered',
          '--term',
          'Incident=Something gone wrong',
          '--term',
          'Trigger=To raise',
        );

        cli(root, 'generate', 'repository', 'billing', 'Incident');

        cli(
          root,
          'generate',
          'command',
          'billing',
          'AcknowledgeIncident',
          '--creates',
          '--aggregate',
          'Incident',
          '--term',
          'Acknowledge=To take over',
          '--public',
        );
      },
      { ...EVENT_SOURCED, di: 'manual', orm: 'knex' },
    );
  }, 240_000);

  it('type-checks and passes the checker, with IncidentTriggered in the event, the codec and the specs', () => {
    const compiled = runIn(project.root, {
      command: process.execPath,
      args: [NATIVE_COMPILER, '-p', 'tsconfig.json', '--noEmit'],
    });

    expect(compiled).toBe('');

    // The module of billing, with the whole scaffold registered by hand, is long on its own: nothing else may be reported.
    expect(
      project
        .checked()
        .filter(({ file }) => !file.endsWith('billing.module.ts'))
        .map(({ ruleId, file }) => `${ruleId} ${file}`),
    ).toEqual([]);

    expect(read(project.root, `${BILLING}/domain/events/incident-triggered.event.ts`)).toContain(
      'billing.incident.triggered',
    );

    expect(read(project.root, `${BILLING}/billing.module.ts`)).toContain('platform.eventSourcing.events');
  }, 180_000);

  it('passes the specs it generated, the birth event spec among them', () => {
    const specs = runIn(project.root, { command: bin('vitest'), args: ['run', `${BILLING}/test/unit/incident`] });

    expect(specs).toMatch(/Test Files\s+2 passed \(2\)/);
  }, 120_000);
});
