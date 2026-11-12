import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, write } from './helpers';
import { failure } from './reports';

const BILLING = 'src/contexts/billing';
const MODULES = { invoices: {}, reminders: {}, ledgers: {} };
const INVOICE = 'invoices/domain/aggregates/invoice.aggregate.ts';
const REMINDER = 'reminders/domain/aggregates/reminder.aggregate.ts';
const DUNNING = 'domain/services/dunning.service.ts';

/** A source that imports the files named, relative to billing, by the alias of the project. */
function importing(...files: string[]): string {
  const imports = files.map((file, at) => `import { n${at} } from '@/contexts/billing/${file.replace(/\.ts$/, '')}';`);

  return [...imports, `export const n0 = ${files.length};`, ''].join('\n');
}

/** A project holding billing as `files` lay it out: each path relative to billing, with what it imports. */
function billingWith(files: Readonly<Record<string, readonly string[]>>, rules: object = {}): string {
  const root = tempDir('move-to-module-cycles');
  const contexts = { billing: { classification: 'core', upstreams: [], modules: MODULES } };

  write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts, rules }));

  for (const [file, imported] of Object.entries(files)) {
    write(root, `${BILLING}/${file}`, importing(...imported));
  }

  return root;
}

/** Reminders imports invoices already; dunning, at the level of the context, imports reminders. */
function dunningBetween(rules: object = {}): string {
  return billingWith({ [INVOICE]: [], [REMINDER]: [INVOICE], [DUNNING]: [REMINDER] }, rules);
}

describe('move-to-module, when the move would close a cycle between modules', () => {
  it('writes nothing and names the cycle, the imports that make it and the file to move along', () => {
    const root = dunningBetween();
    const refused = cli(root, 'move-to-module', 'billing', 'invoices', DUNNING);

    expect(refused.code).toBe(2);
    expect(refused.stdout).toBe('');

    expect(refused.stderr.split('\n')).toEqual([
      'error: Nothing was moved: the move would close between the modules of "billing" a cycle that is not there now.',
      '  invoices -> reminders -> invoices',
      '    invoices -> reminders, which the move adds:',
      `      ${BILLING}/${DUNNING}:1 imports ${BILLING}/${REMINDER}`,
      '    reminders -> invoices, which is there now:',
      `      ${BILLING}/${REMINDER}:1 imports ${BILLING}/${INVOICE}`,
      `  fix: Move along, in the same command, what stands at the other end of the imports the move adds: ${REMINDER}; the command judges that move the same way.`,
      '       Invert one of the imports above before the move: `ddd-ts-kit explain module/no-cycle` gives the ways (a domain event, a module of its own for the concept both reach for, a projection).',
      '       Pass --allow-cycle to move as asked all the same: module/no-cycle then reports the cycle.',
    ]);

    expect(exists(root, `${BILLING}/${DUNNING}`)).toBe(true);
    expect(exists(root, `${BILLING}/invoices/${DUNNING}`)).toBe(false);
  });

  it('refuses a dry run with the same words, and says the refusal as JSON when asked', () => {
    const root = dunningBetween();
    const refused = cli(root, 'move-to-module', 'billing', 'invoices', DUNNING);
    const dryRun = cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--dry-run');
    const asJson = failure(cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--json'));

    expect(dryRun.code).toBe(2);
    expect(dryRun.stderr).toBe(refused.stderr);
    expect(asJson.message).toContain('invoices -> reminders -> invoices');
    expect(asJson.fix).toContain('--allow-cycle');
  });

  it('moves once the file at the other end moves along, as the refusal says', () => {
    const root = dunningBetween();
    const moved = cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, REMINDER);

    expect(moved.code).toBe(0);
    expect(moved.stdout).not.toContain('module/no-cycle');
    expect(exists(root, `${BILLING}/invoices/${DUNNING}`)).toBe(true);
    expect(exists(root, `${BILLING}/invoices/domain/aggregates/reminder.aggregate.ts`)).toBe(true);
  });

  it('moves with --allow-cycle, says the cycle where the files now are, and module/no-cycle reports that cycle', () => {
    const root = dunningBetween();
    const moved = cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--allow-cycle');

    expect(moved.code).toBe(0);

    expect(moved.stdout.split('\n')).toEqual(
      expect.arrayContaining([
        'Closed between modules, which module/no-cycle reports:',
        '  invoices -> reminders -> invoices',
        '    invoices -> reminders, which the move adds:',
        `      ${BILLING}/invoices/${DUNNING}:1 imports ${BILLING}/${REMINDER}`,
      ]),
    );

    expect(read(root, `${BILLING}/invoices/${DUNNING}`)).toContain('reminder.aggregate');

    expect(cli(root, 'check', '--rule', 'module/no-cycle').stdout).toContain(
      'import each other in a cycle: invoices -> reminders -> invoices.',
    );
  });

  it('shows the cycle of a dry run with --allow-cycle where the files still are, as text and as JSON', () => {
    const root = dunningBetween();
    const shown = cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--allow-cycle', '--dry-run');
    const asJson = cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--allow-cycle', '--dry-run', '--json');

    expect(shown.code).toBe(0);
    expect(shown.stdout).toContain('Would close between modules, which module/no-cycle reports:');
    expect(shown.stdout).toContain(`      ${BILLING}/${DUNNING}:1 imports ${BILLING}/${REMINDER}`);
    expect(exists(root, `${BILLING}/${DUNNING}`)).toBe(true);

    expect(asJson.json()).toMatchObject({
      dryRun: true,
      cycles: [
        {
          modules: ['invoices', 'reminders'],
          steps: [
            { from: 'invoices', to: 'reminders', added: true, imports: [{ file: `${BILLING}/${DUNNING}`, line: 1 }] },
            { from: 'reminders', to: 'invoices', added: false },
          ],
        },
      ],
    });
  });
});

describe('move-to-module, on what it names of a cycle', () => {
  it('names the importer as the file to move along when another module imports the moved file', () => {
    const ledger = 'ledgers/domain/aggregates/ledger.aggregate.ts';
    const root = billingWith({ [INVOICE]: [ledger], [ledger]: [DUNNING], [DUNNING]: [] });
    const refused = failure(cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--json'));

    expect(refused.message).toContain(
      `ledgers -> invoices, which the move adds:\n      ${BILLING}/${ledger}:1 imports`,
    );

    expect(refused.fix).toContain(`the imports the move adds: ${ledger};`);
  });

  it('names one cycle once when the move adds both of its steps, and no file to move along that cannot move', () => {
    const table = 'reminders/reminders.module.ts';
    const root = billingWith({ [table]: [DUNNING], [DUNNING]: ['reminders/domain/services/missing.service.ts'] });
    const refused = failure(cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--json'));

    expect(refused.message.match(/invoices -> reminders -> invoices/g)).toHaveLength(1);
    expect(refused.message).toContain('reminders -> invoices, which the move adds:');
    expect(refused.fix).toMatch(/^Invert one of the imports above/);
  });

  it('names each cycle the move closes, the shortest through each step, and the first imports of a step there now', () => {
    const ledger = 'ledgers/domain/aggregates/ledger.aggregate.ts';
    const others = ['one', 'two', 'three', 'four'].map((name) => `reminders/domain/services/${name}.service.ts`);

    const root = billingWith({
      [INVOICE]: [],
      [REMINDER]: [ledger, INVOICE],
      [ledger]: [INVOICE],
      ...Object.fromEntries(others.map((file) => [file, [INVOICE]])),
      [DUNNING]: [REMINDER, ledger],
    });

    const refused = failure(cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--json'));

    expect(refused.message).toContain('2 cycles that are not there now');
    expect(refused.message).toContain('\n  invoices -> reminders -> invoices\n');
    expect(refused.message).toContain('\n  invoices -> ledgers -> invoices\n');
    expect(refused.message).not.toContain('invoices -> reminders -> ledgers');
    expect(refused.message).toContain('\n      and 2 more');
  });
});

describe('move-to-module, when the move closes no cycle of its own', () => {
  it('moves into a cycle that is there already without a word of it', () => {
    const root = billingWith({ [INVOICE]: [REMINDER], [REMINDER]: [INVOICE], [DUNNING]: [REMINDER] });
    const moved = cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--json');

    expect(moved.code).toBe(0);
    expect(moved.json()).toMatchObject({ dryRun: false, cycles: [] });
    expect(exists(root, `${BILLING}/invoices/${DUNNING}`)).toBe(true);
  });

  it('moves a file that adds a dependency no module answers, a cycle between two others left out of it', () => {
    const ledger = 'ledgers/domain/aggregates/ledger.aggregate.ts';
    const root = billingWith({ [REMINDER]: [ledger], [ledger]: [REMINDER], [DUNNING]: [REMINDER] });

    expect(cli(root, 'move-to-module', 'billing', 'invoices', DUNNING).code).toBe(0);
    expect(exists(root, `${BILLING}/invoices/${DUNNING}`)).toBe(true);
  });

  it('judges nothing in a project that turns module/no-cycle off', () => {
    const root = dunningBetween({ 'module/no-cycle': 'off' });
    const moved = cli(root, 'move-to-module', 'billing', 'invoices', DUNNING);

    expect(moved.code).toBe(0);
    expect(moved.stdout).not.toContain('module/no-cycle');
    expect(exists(root, `${BILLING}/invoices/${DUNNING}`)).toBe(true);
  });
});

describe('context-layout, which moves files into modules too', () => {
  it('leaves where it is the file that would close a cycle, so that module/no-cycle has nothing to report after it', () => {
    const root = billingWith({ [INVOICE]: [DUNNING], [REMINDER]: [INVOICE], [DUNNING]: [REMINDER] });
    const laid = cli(root, 'context-layout', 'billing', '--json');

    expect(laid.code).toBe(0);
    expect(JSON.stringify(laid.json())).toContain('it would make invoices depend on that module');
    expect(exists(root, `${BILLING}/${DUNNING}`)).toBe(true);
    expect(cli(root, 'check', '--rule', 'module/no-cycle').stdout).not.toContain('import each other in a cycle');
  });
});
