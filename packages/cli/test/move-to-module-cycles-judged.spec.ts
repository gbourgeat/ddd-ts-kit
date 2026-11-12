import { describe, expect, it } from 'vitest';
import { cli, exists, write } from './helpers';
import { failure } from './reports';
import { BILLING, billingWith, DUNNING, INVOICE, REMINDER } from './support/billing-in-modules';
import { git } from './support/git';

const LEDGER = 'ledgers/domain/aggregates/ledger.aggregate.ts';

/** The setting that turns module/no-cycle off for the files the globs name. */
function offFor(...files: string[]): object {
  return { 'module/no-cycle': { severity: 'off', files } };
}

describe('move-to-module judges a cycle as module/no-cycle will', () => {
  it('moves without a word when the config turns the rule off for every file the cycle is written in', () => {
    const root = billingWith({ [INVOICE]: [], [REMINDER]: [INVOICE], [DUNNING]: [REMINDER] }, offFor(`${BILLING}/**`));
    const moved = cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--json');

    expect(moved.code).toBe(0);
    expect(moved.json()).toMatchObject({ cycles: [] });
    expect(cli(root, 'check', '--rule', 'module/no-cycle').stdout).not.toContain('import each other in a cycle');
  });

  it('still refuses when the rule is off for some of those files only', () => {
    const root = billingWith(
      { [INVOICE]: [], [REMINDER]: [INVOICE], [DUNNING]: [REMINDER] },
      offFor(`${BILLING}/invoices/**`),
    );

    expect(cli(root, 'move-to-module', 'billing', 'invoices', DUNNING).code).toBe(2);
    expect(exists(root, `${BILLING}/${DUNNING}`)).toBe(true);
  });

  it('reads no file the checker does not read: one git ignores, one of a dist folder', () => {
    const local = 'reminders/domain/services/local.service.ts';
    const root = billingWith({ [INVOICE]: [], [REMINDER]: [], [local]: [INVOICE], [DUNNING]: [REMINDER] });

    write(root, `${BILLING}/reminders/domain/dist/built.service.ts`, `import '@/contexts/billing/${INVOICE}';\n`);

    expect(cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--dry-run').code).toBe(2);

    git(root, 'init', '--quiet');
    write(root, '.gitignore', 'local.service.ts\n');

    expect(cli(root, 'move-to-module', 'billing', 'invoices', DUNNING).code).toBe(0);
    expect(exists(root, `${BILLING}/invoices/${DUNNING}`)).toBe(true);
  });
});

describe('move-to-module, on the cycle and the advice of a refusal', () => {
  it('names the shortest cycle through the step the move adds, whatever cycle the search met first', () => {
    const archive = 'archives/domain/aggregates/archive.aggregate.ts';

    const root = billingWith({
      [INVOICE]: [],
      [REMINDER]: [archive, LEDGER],
      [archive]: [LEDGER],
      [LEDGER]: [INVOICE],
      [DUNNING]: [REMINDER],
    });

    const refused = failure(cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--json'));

    expect(refused.message).toContain('\n  invoices -> reminders -> ledgers -> invoices\n');
    expect(refused.message).not.toContain('archives');
  });

  it('names the folder of a use case to move along, not one file of it', () => {
    const command = 'reminders/application/commands/send-reminder/send-reminder.command.ts';
    const root = billingWith({ [INVOICE]: [], [REMINDER]: [INVOICE], [command]: [], [DUNNING]: [command] });
    const refused = failure(cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--json'));

    expect(refused.fix).toContain('the imports the move adds: reminders/application/commands/send-reminder;');
  });

  it('tells an import of a folder by the index.ts it reaches, and names that folder to move along', () => {
    const folder = 'reminders/domain/aggregates';

    const root = billingWith({
      [INVOICE]: [],
      [REMINDER]: [INVOICE],
      [`${folder}/index.ts`]: [],
      [DUNNING]: [folder],
    });

    const refused = failure(cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--json'));

    expect(refused.message).toContain(`${BILLING}/${DUNNING}:1 imports ${BILLING}/${folder}/index.ts\n`);
    expect(refused.fix).toContain(`the imports the move adds: ${folder};`);
  });

  it('gives a script the cycles and the files to move along in the error of --json', () => {
    const root = billingWith({ [INVOICE]: [], [REMINDER]: [INVOICE], [DUNNING]: [REMINDER] });
    const refused = cli(root, 'move-to-module', 'billing', 'invoices', DUNNING, '--json');

    expect(refused.code).toBe(2);

    expect(refused.json()).toMatchObject({
      error: {
        along: [REMINDER],
        cycles: [
          {
            modules: ['invoices', 'reminders'],
            steps: [
              {
                from: 'invoices',
                to: 'reminders',
                added: true,
                imports: [{ file: `${BILLING}/${DUNNING}`, line: 1, imported: `${BILLING}/${REMINDER}` }],
              },
              { from: 'reminders', to: 'invoices', added: false },
            ],
          },
        ],
      },
    });
  });
});
