import { beforeAll, describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support.js';
import { cli, exists, read, scaffoldEverything, tempDir, write } from './helpers.js';
import { report } from './reports.js';

const BILLING = 'src/contexts/billing';
const AGGREGATE = `${BILLING}/domain/aggregates/ledger.aggregate.ts`;
const CODEC = `${BILLING}/infrastructure/persistence/ledger-events.mapper.ts`;
const LOCK = 'stored-events.lock.json';

let root: string;

beforeAll(() => {
  root = tempDir('event-sourced');
  scaffoldEverything(root);
});

describe('generate aggregate --event-sourced', () => {
  it('refuses a birth fact the glossary does not define, and says how to define it', () => {
    const refused = cli(
      root,
      'generate',
      'aggregate',
      'billing',
      'Ledger',
      '--event-sourced',
      '--term',
      'Ledger=The payments of a customer',
    );

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('"Created" uses "created"');
  });

  it('writes the aggregate with its birth event and its apply method, the codec, a builder that replays and a spec', () => {
    const generated = report(
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
        '--json',
      ),
    );

    expect(generated.created).toEqual([
      AGGREGATE,
      CODEC,
      `${BILLING}/test/builders/ledger.builder.ts`,
      `${BILLING}/test/unit/ledger.aggregate.spec.ts`,
      `${BILLING}/domain/events/ledger-created.event.ts`,
      `${BILLING}/test/unit/ledger-created.event.spec.ts`,
    ]);

    expect(read(root, AGGREGATE)).toContain(
      'export class Ledger extends EventSourcedAggregate<LedgerEvent, LedgerState> {',
    );

    expect(read(root, AGGREGATE)).toContain('[LedgerCreated.eventName]: (event) => this.applyCreated(event),');
    expect(read(root, CODEC)).toContain('[LedgerCreated.eventName]: defineStoredEvent(LedgerCreated, {');

    expect(read(root, `${BILLING}/test/builders/ledger.builder.ts`)).toContain(
      'return Ledger.rehydrate(ingredients.id, {',
    );

    expect(exists(root, LOCK)).toBe(false);
  });

  it('adds a later event to the union, to appliers() with an apply method, and to the codec', () => {
    cli(root, 'generate', 'domain-event', 'billing', 'Ledger', 'Credited', '--term', 'Credit=To add money', '--json');

    const aggregate = read(root, AGGREGATE);

    expect(aggregate).toContain('export type LedgerEvent = LedgerCreated | LedgerCredited;');

    expect(aggregate).toContain(
      "import { LedgerCredited } from '@/contexts/billing/domain/events/ledger-credited.event';",
    );

    expect(aggregate).toContain(
      '      [LedgerCreated.eventName]: (event) => this.applyCreated(event),\n      [LedgerCredited.eventName]: (event) => this.applyCredited(event),\n    };',
    );

    expect(aggregate).toContain('  private applyCredited(event: LedgerCredited): void {');
    expect(read(root, CODEC)).toContain('interface LedgerCreditedData {}');

    expect(read(root, CODEC)).toContain(
      '  [LedgerCredited.eventName]: defineStoredEvent(LedgerCredited, {\n    version: 1,',
    );
  });

  it('passes the checker, keeps the generated docs current but its stored versions unrecorded, and says which aggregates are event-sourced', () => {
    const checked = checkJsonOf(cli(root, 'check', '--json'));

    expect(checked.violations.filter(({ file }) => file.includes('ledger'))).toEqual([]);

    expect(cli(root, 'docs', '--check', '--json').json()).toEqual({
      ok: false,
      stale: [],
      drift: {},
      unrecorded: ['billing.ledger.created version 1', 'billing.ledger.credited version 1'],
      formerlyRecorded: [],
    });

    expect(read(root, `${BILLING}/CONTEXT.md`)).toContain('- `Invoice`\n- `Ledger` (event-sourced)');
    expect(cli(root, 'describe', 'billing').stdout).toContain('    Ledger (event-sourced)');
    expect(cli(root, 'list').stdout).toContain('aggregates: Invoice, Ledger (event-sourced)');
  });
});

describe('docs --stored-events', () => {
  it('records the stored shapes on purpose, and the checker then refuses a shape changed in place', () => {
    const unrecorded = cli(root, 'docs', '--check');

    expect(unrecorded.code).toBe(1);
    expect(unrecorded.stdout).toContain(`unrecorded  billing.ledger.credited version 1 in ${LOCK}`);
    expect(unrecorded.stdout).toContain('run `ddd-ts-kit docs --stored-events`');

    cli(root, 'docs', '--stored-events');

    const recorded = read(root, LOCK);

    expect(Object.keys(JSON.parse(recorded))).toEqual(['billing.ledger.created', 'billing.ledger.credited']);
    expect(cli(root, 'docs', '--check').code).toBe(0);

    write(
      root,
      CODEC,
      read(root, CODEC).replace(
        'interface LedgerCreditedData {}',
        'interface LedgerCreditedData {\n  readonly cents: number;\n}',
      ),
    );

    cli(root, 'docs', '--stored-events');

    expect(read(root, LOCK)).toBe(recorded);

    expect(
      checkJsonOf(cli(root, 'check', '--json')).violations.filter(
        ({ ruleId }) => ruleId === 'event-sourcing/upcaster-required',
      ),
    ).toEqual([
      expect.objectContaining({ file: CODEC, message: 'The stored shape of LedgerCredited in version 1 changed.' }),
    ]);
  });
});
