import { beforeAll, describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, exists, read, write } from './helpers';
import { BILLING, projectWithModule } from './support/project-with-module';

/** The credit note, an aggregate and its use case written in the module invoices, which the guidance specs build on. */
function withCreditNote(root: string): void {
  if (exists(root, `${BILLING}/invoices/domain/aggregates/credit-note.aggregate.ts`)) {
    return;
  }

  const terms = ['--term', 'Credit=An amount given back', '--term', 'Note=A written record'];

  expect(cli(root, 'generate', 'aggregate', 'billing', 'CreditNote', '--module', 'invoices', ...terms).code).toBe(0);

  const command = [
    'command',
    'billing',
    'IssueCreditNote',
    '--creates',
    '--aggregate',
    'CreditNote',
    '--permission',
    'credit-note.issue',
  ];

  expect(cli(root, 'generate', ...command, '--module', 'invoices').code).toBe(0);
}

describe('what guides the move into modules, and what refuses it', () => {
  let root: string;

  beforeAll(() => {
    root = projectWithModule();
    withCreditNote(root);
  }, 120_000);

  it('refuses --module on a kind that writes in no context', () => {
    const refused = cli(root, 'generate', 'worker', '--module', 'invoices');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('generate worker writes nothing into a module of the model');
  });

  it('points the next steps at the file in its module, not at the path without it', () => {
    const terms = ['--term', 'Refund=An amount given back'];

    const generated = cli(
      root,
      'generate',
      'command',
      'billing',
      'RefundCreditNote',
      '--creates',
      '--aggregate',
      'CreditNote',
      '--permission',
      'credit-note.refund',
      '--module',
      'invoices',
      ...terms,
      '--json',
    );

    const report = generated.json() as { next: string[] };

    expect(generated.code).toBe(0);
    expect(report.next.filter((step) => step.includes('/application/'))).not.toEqual([]);

    expect(
      report.next.filter((step) => step.includes('/application/') && !step.includes('/invoices/application/')),
    ).toEqual([]);
  });

  it('moves nothing when two files would land on one path, or when another module holds a twin', () => {
    expect(
      cli(
        root,
        'generate',
        'module',
        'billing',
        'reminders',
        '--purpose',
        'The reminders.',
        '--term',
        'Reminder=A message about an unpaid invoice',
      ).code,
    ).toBe(0);

    write(root, `${BILLING}/domain/value-objects/twin.vo.ts`, 'export const flat = 1;\n');
    write(root, `${BILLING}/reminders/domain/value-objects/twin.vo.ts`, 'export const inReminders = 1;\n');

    const colliding = cli(
      root,
      'move-to-module',
      'billing',
      'invoices',
      'domain/value-objects/twin.vo.ts',
      'reminders/domain/value-objects/twin.vo.ts',
    );

    expect(colliding.code).not.toBe(0);
    expect(colliding.stderr).toContain('written twice');
    expect(read(root, `${BILLING}/domain/value-objects/twin.vo.ts`)).toBe('export const flat = 1;\n');
    expect(read(root, `${BILLING}/reminders/domain/value-objects/twin.vo.ts`)).toBe('export const inReminders = 1;\n');

    const twinned = cli(root, 'move-to-module', 'billing', 'invoices', 'domain/value-objects/twin.vo.ts');

    expect(twinned.code).not.toBe(0);
    expect(twinned.stderr).toContain('same role and name');
    expect(exists(root, `${BILLING}/invoices/domain/value-objects/twin.vo.ts`)).toBe(false);
  });

  it('tells a stray folder inside a module where its files go, not to declare it as a module', () => {
    write(root, `${BILLING}/invoices/domain/helpers/rounding.ts`, 'export const rounding = 1;\n');

    const { violations } = checkJsonOf(cli(root, 'check', '--rule', 'tree/closed', '--json'));
    const stray = violations.find((violation) => violation.file.endsWith('invoices/domain/helpers'));

    expect(stray).toBeDefined();
    expect(stray?.fix).not.toContain('generate module');
  });
});

describe('what the generator and the move say, in a context with modules', () => {
  let root: string;

  beforeAll(() => {
    root = projectWithModule();
    withCreditNote(root);
  }, 120_000);

  it('refuses an unknown context before judging its module', () => {
    const refused = cli(root, 'generate', 'aggregate', 'biling', 'Invoice', '--module', 'invoices');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('Unknown context "biling"');
  });

  it('places a file with the use case that holds it, and refuses to split the use case between two modules', () => {
    expect(
      cli(
        root,
        'generate',
        'module',
        'billing',
        'reminders',
        '--purpose',
        'The reminders.',
        '--term',
        'Reminder=A message about an unpaid invoice',
      ).code,
    ).toBe(0);

    const again = cli(
      root,
      'generate',
      'command',
      'billing',
      'IssueCreditNote',
      '--creates',
      '--aggregate',
      'CreditNote',
      '--permission',
      'credit-note.issue',
    );

    expect(again.code).toBe(0);
    expect(exists(root, `${BILLING}/application/commands/issue-credit-note`)).toBe(false);

    const split = cli(
      root,
      'generate',
      'command',
      'billing',
      'IssueCreditNote',
      '--creates',
      '--aggregate',
      'CreditNote',
      '--permission',
      'credit-note.issue',
      '--module',
      'reminders',
    );

    expect(split.code).not.toBe(0);
    expect(split.stderr).toContain('would split it between two modules');
    expect(exists(root, `${BILLING}/reminders/application/commands/issue-credit-note`)).toBe(false);
  });

  it('reports the generated files the move derived, besides what it moved and rewrote', () => {
    const useCases = ['application/commands/issue-invoice', 'application/commands/cancel-invoice'];
    const moved = cli(root, 'move-to-module', 'billing', 'invoices', ...useCases, '--json');
    const report = moved.json() as { written: string[]; deleted: string[] };

    expect(moved.code).toBe(0);

    expect(report.written).toContain(`${BILLING}/invoices/application/application.declarations.ts`);
    expect(cli(root, 'docs', '--check').stdout).toBe('The generated documentation is up to date.');
  });
});
