import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, DEFAULT_STACK, exists, read, scaffoldEverything, tempDir, write } from './helpers';
import { type Report, report } from './reports';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';
const AGGREGATE = `${BILLING}/domain/aggregates/ledger.aggregate.ts`;
const CODEC = `${BILLING}/infrastructure/persistence/ledger-events.mapper.ts`;
const LOCK = 'stored-events.lock.json';

let root: string;

beforeAll(() => {
  root = tempDir('event-sourced');
  scaffoldEverything(root, { ...DEFAULT_STACK, 'event-sourcing': 'on' });
});

describe('generate aggregate --event-sourced', () => {
  it('refuses an event-sourced aggregate while the platform has no event store, with the init --force to run', () => {
    const project = initProject('--context', 'billing:core');

    const refused = cli(
      project,
      'generate',
      'aggregate',
      'billing',
      'Ledger',
      '--event-sourced',
      '--term',
      'Ledger=Payments',
      '--term',
      'Create=To open',
    );

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('stack.eventSourcing is "off"');
    expect(refused.stderr).toContain('init --force --event-sourcing on');
    expect(exists(project, AGGREGATE)).toBe(false);
  });

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
      warnings: [],
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

describe('generate domain-event on an event-sourced aggregate reshaped by hand', () => {
  const TERMS = [
    '--term',
    'Ledger=The payments of a customer',
    '--term',
    'Create=To open',
    '--term',
    'Credit=To add money',
  ];

  function ledger(): string {
    const project = initProject('--context', 'billing:core', '--event-sourcing', 'on');
    const generated = cli(project, 'generate', 'aggregate', 'billing', 'Ledger', '--event-sourced', ...TERMS);

    expect(generated.code, generated.stderr).toBe(0);

    return project;
  }

  function credited(project: string): Report {
    return report(cli(project, 'generate', 'domain-event', 'billing', 'Ledger', 'Credited', ...TERMS, '--json'));
  }

  const NOTE = 'Ledger is event-sourced: add LedgerCredited to the union of its events';

  it('says what to write when the aggregate has no appliers() it can read', () => {
    const project = ledger();
    const reshaped = read(project, AGGREGATE).replace('protected appliers(', 'protected handlers(');

    write(project, AGGREGATE, reshaped);

    expect(credited(project).notes.join('\n')).toContain(NOTE);
    expect(read(project, AGGREGATE)).toBe(reshaped);
  });

  it('says what to write when the codec of the stored events is gone or was reshaped', () => {
    const gone = ledger();
    const reshaped = ledger();

    fs.rmSync(path.join(gone, CODEC));
    write(reshaped, CODEC, read(reshaped, CODEC).replaceAll('\n/**', '\n/*'));

    expect(credited(gone).notes.join('\n')).toContain(NOTE);
    expect(credited(reshaped).notes.join('\n')).toContain(NOTE);
    expect(read(reshaped, AGGREGATE)).not.toContain('LedgerCredited');
  });
});
