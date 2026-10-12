import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers.js';
import { failure, report } from './reports.js';

const BILLING = 'src/contexts/billing';
const JOB = `${BILLING}/application/scheduling/cancel-stale-invoices.job.ts`;
const COMMAND = `${BILLING}/application/commands/cancel-invoice/cancel-invoice.command.ts`;
const AUTH = 'src/platform/auth';

const EVERY_QUARTER = [
  'generate',
  'job',
  'billing',
  'CancelStaleInvoices',
  '--every',
  '15m',
  '--command',
  'CancelInvoice',
  '--term',
  'Stale=Left unpaid for too long',
  '--json',
];

describe('generate job, the grant of its system actor', () => {
  it('adds a rule that permits this actor alone, under attribute policies', () => {
    const root = project('--authz', 'abac');
    const generated = report(cli(root, ...EVERY_QUARTER));

    const rule =
      "  permit(\n    'system-billing.cancel-stale-invoices',\n    [billingPermissions['invoice.cancel']],\n    ({ actor }) => actor.id === 'system:billing.cancel-stale-invoices',\n  ),";

    expect(read(root, `${AUTH}/attribute-policies.ts`)).toContain(
      `  // ddd-ts-kit:system-grants\n${rule}\n  // /ddd-ts-kit:system-grants`,
    );

    expect(generated.todos.find((todo) => todo.text.startsWith('check this rule'))).toMatchObject({
      file: `${AUTH}/attribute-policies.ts`,
      // The rule takes several lines: the step points at the one that names it.
      line: 18,
    });

    expect(read(root, JOB)).not.toContain('grant the system actor');
  });

  it('relates this actor to its context as an operator, under relationships, and writes the tuple when the application starts', () => {
    const root = project('--authz', 'rebac');
    const generated = report(cli(root, ...EVERY_QUARTER));

    const tuple =
      "  { object: 'context:billing', relation: 'operator', subject: 'system:system:billing.cancel-stale-invoices' },";

    expect(read(root, `${AUTH}/relate-system-actors.ts`)).toContain(
      `  // ddd-ts-kit:system-grants\n${tuple}\n  // /ddd-ts-kit:system-grants`,
    );

    expect(read(root, `${AUTH}/relationship-schema.ts`)).toContain(
      "  system: {},\n  context: {\n    relations: { operator: ['user', 'system'] },",
    );

    expect(read(root, 'src/platform/compose-application.ts')).toContain(
      'start: () =>\n      relateSystemActors()\n        .then(() => container.start())',
    );

    expect(generated.todos.find((todo) => todo.text.startsWith('check this relationship'))?.text).toContain(
      '`system:billing.cancel-stale-invoices` now operates the context `billing`',
    );

    expect(read(root, JOB)).not.toContain('grant the system actor');
  });

  it('leaves the relationship to the team once the schema no longer lets a system actor operate a context', () => {
    const root = project('--authz', 'rebac');

    write(
      root,
      `${AUTH}/relationship-schema.ts`,
      read(root, `${AUTH}/relationship-schema.ts`).replace("['user', 'system']", "['user']"),
    );

    const generated = report(cli(root, ...EVERY_QUARTER));

    expect(read(root, `${AUTH}/relate-system-actors.ts`)).not.toContain('cancel-stale-invoices');
    expect(generated.todos.find((todo) => todo.text.startsWith('grant the system actor'))).toMatchObject({ file: JOB });
  });

  it('leaves the grant to the team, as a decision written in the job, under a model of their own or once the region is gone', () => {
    const custom = project('--authz', 'custom');
    const edited = project();

    write(
      edited,
      `${AUTH}/roles.ts`,
      read(edited, `${AUTH}/roles.ts`).replace(/ {4}\/\/ \/?ddd-ts-kit:system-grants\n/g, ''),
    );

    for (const root of [custom, edited]) {
      const generated = report(cli(root, ...EVERY_QUARTER));
      const grant = generated.todos.find((todo) => todo.text.startsWith('grant the system actor'));

      expect(grant?.file).toBe(JOB);

      expect(grant?.text).toContain(
        '`system:billing.cancel-stale-invoices` the permission `billing:invoice.cancel` in the authorization model of the platform',
      );

      expect(generated.next).toContain(`${JOB}:${grant?.line}`);
    }
  });

  it('gives the role of system actors each permission once, whatever the number of jobs that need it', () => {
    const root = project();

    expect(cli(root, ...EVERY_QUARTER).code).toBe(0);

    expect(
      cli(
        root,
        'generate',
        'job',
        'billing',
        'CancelInvoicesNightly',
        '--cron',
        '0 2 * * *',
        '--command',
        'CancelInvoice',
        '--term',
        'Nightly=Once a night',
      ).code,
    ).toBe(0);

    expect(read(root, `${AUTH}/roles.ts`).match(/billingPermissions\['invoice\.cancel'\],/g)).toHaveLength(1);
  });
});

describe('generate job, a grant written by 0.5', () => {
  it('reads a grant 0.5 wrote by its id as given, and does not give it a second time', () => {
    const rbac = project();
    const abac = project('--authz', 'abac');
    const raw = "'billing:invoice.cancel',";

    write(
      rbac,
      `${AUTH}/roles.ts`,
      read(rbac, `${AUTH}/roles.ts`).replace(
        '// /ddd-ts-kit:system-grants',
        `${raw}\n    // /ddd-ts-kit:system-grants`,
      ),
    );

    write(
      abac,
      `${AUTH}/attribute-policies.ts`,
      read(abac, `${AUTH}/attribute-policies.ts`).replace(
        '// /ddd-ts-kit:system-grants',
        "permit(\n    'system-billing.cancel-stale-invoices',\n    ['billing:invoice.cancel'],\n    () => true,\n  ),\n  // /ddd-ts-kit:system-grants",
      ),
    );

    for (const root of [rbac, abac]) {
      expect(cli(root, ...EVERY_QUARTER).code).toBe(0);
    }

    expect(read(rbac, `${AUTH}/roles.ts`)).not.toContain("billingPermissions['invoice.cancel']");

    expect(read(abac, `${AUTH}/attribute-policies.ts`).match(/'system-billing\.cancel-stale-invoices'/g)).toHaveLength(
      1,
    );
  });
});

describe('generate job, a command a job cannot build', () => {
  const withConstructor = (root: string, parameters: string): void => {
    write(
      root,
      COMMAND,
      read(root, COMMAND).replace(
        / {2}\/\/ TODO\(domain\)[^\n]*\n/,
        `  constructor(${parameters}) {\n    super(actor);\n  }\n`,
      ),
    );
  };

  it('refuses a command whose constructor needs what a job does not know, and says what to send instead', () => {
    const root = project();

    withConstructor(root, 'actor: Actor, readonly invoiceId: string, readonly lines: Map<string, number>');

    const refused = cli(root, ...EVERY_QUARTER);

    expect(refused.code).toBe(2);

    expect(failure(refused).message).toBe(
      'The constructor of CancelInvoiceCommand needs `invoiceId`, `lines`, which a job cannot know.',
    );

    expect(failure(refused).fix).toContain('ddd-ts-kit generate command billing <UseCaseName>');
    expect(cli(root, 'list', '--json').stdout).not.toContain('cancel-stale-invoices');
  });

  it('accepts the instant the work is for, followed by parameters the command can do without', () => {
    const root = project();

    withConstructor(root, 'actor: Actor, readonly dueBefore: Date, readonly limit = 100, readonly reason?: string');

    expect(cli(root, ...EVERY_QUARTER).code).toBe(0);

    expect(read(root, JOB)).toContain(
      "new CancelInvoiceCommand(systemActor('billing.cancel-stale-invoices'), execution.scheduledAt)",
    );
  });
});

function project(...flags: string[]): string {
  const root = tempDir('job-grant');

  expect(cli(root, 'init', ...flags).code).toBe(0);

  expect(
    cli(
      root,
      'generate',
      'context',
      'billing',
      '--classification',
      'core',
      '--term',
      'Invoice=A request for payment',
      '--term',
      'Cancel=To void an invoice',
    ).code,
  ).toBe(0);

  expect(cli(root, 'generate', 'command', 'billing', 'CancelInvoice', '--permission', 'invoice.cancel').code).toBe(0);

  return root;
}
