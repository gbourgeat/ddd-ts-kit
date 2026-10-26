import { beforeAll, describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, DEFAULT_STACK, exists, read, scaffoldEverything, tempDir, write } from './helpers';
import { PURPOSE } from './support/project-with-module';

const MODULE = 'src/contexts/billing/invoices';
const CODEC = `${MODULE}/infrastructure/persistence/ledger-events.mapper.ts`;
const LOCK = 'stored-events.lock.json';
const EMPTY_HASH = 'sha256:e3b0c44298fc1c14';

let root: string;

beforeAll(() => {
  root = tempDir('stored-events-modules');
  scaffoldEverything(root, { ...DEFAULT_STACK, 'event-sourcing': 'on' });

  const module = cli(root, 'generate', 'module', 'billing', 'invoices', '--purpose', PURPOSE);

  expect(module.code, module.stderr).toBe(0);

  const generated = cli(
    root,
    'generate',
    'aggregate',
    'billing',
    'Ledger',
    '--event-sourced',
    '--module',
    'invoices',
    '--term',
    'Ledger=The payments of a customer',
    '--term',
    'Create=To open',
  );

  expect(generated.code, generated.stderr).toBe(0);
}, 180_000);

describe('docs --stored-events on a context divided into modules', () => {
  it('refuses the codec of a module whose data declares no member, naming the file and the reason, and writes no lock', () => {
    expect(exists(root, CODEC)).toBe(true);

    const refused = cli(root, 'docs', '--stored-events');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain(`${CODEC}:`);
    expect(refused.stderr).toContain('declares no member');
    expect(exists(root, LOCK)).toBe(false);
  });

  it('records the codec of the module once its data is declared, and never the hash of nothing', () => {
    write(
      root,
      CODEC,
      read(root, CODEC).replace(
        /interface LedgerCreatedData \{\s*\}/,
        'interface LedgerCreatedData {\n  readonly owner: string;\n}',
      ),
    );

    const unrecorded = cli(root, 'docs', '--check', '--json').json();

    expect(unrecorded).toMatchObject({ unrecorded: ['billing.ledger.created version 1'] });

    const recorded = cli(root, 'docs', '--stored-events');

    expect(recorded.code, recorded.stderr).toBe(0);

    const lock = JSON.parse(read(root, LOCK));

    expect(Object.keys(lock)).toEqual(['billing.ledger.created']);
    expect(read(root, LOCK)).not.toContain(EMPTY_HASH.slice('sha256:'.length));
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('refuses a shape changed in place in the codec of the module', () => {
    write(
      root,
      CODEC,
      read(root, CODEC).replace('readonly owner: string;', 'readonly owner: string;\n  readonly cents: number;'),
    );

    expect(
      checkJsonOf(cli(root, 'check', '--json')).violations.filter(
        ({ ruleId }) => ruleId === 'event-sourcing/upcaster-required',
      ),
    ).toEqual([
      expect.objectContaining({ file: CODEC, message: 'The stored shape of LedgerCreated in version 1 changed.' }),
    ]);
  });

  it('reports in docs --check a lock that holds the hash of nothing', () => {
    write(root, LOCK, `${JSON.stringify({ 'billing.ledger.created': { 1: EMPTY_HASH } }, null, 2)}\n`);

    const checked = cli(root, 'docs', '--check');

    expect(checked.code).toBe(1);
    expect(checked.stdout).toContain(`recorded empty  billing.ledger.created version 1 in ${LOCK}`);

    expect(cli(root, 'docs', '--check', '--json').json()).toMatchObject({
      ok: false,
      emptilyRecorded: ['billing.ledger.created version 1'],
    });
  });
});
