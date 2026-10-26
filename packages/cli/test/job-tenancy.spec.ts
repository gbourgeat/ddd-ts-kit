import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';
import { jobProject } from './support/job-project';
import { stringsAt } from './support/strings-at';

const BILLING = 'src/contexts/billing';
const JOB = `${BILLING}/application/scheduling/remind-overdue.job.ts`;
const SPEC = `${BILLING}/test/unit/remind-overdue.job.spec.ts`;

const REMIND = [
  'generate',
  'job',
  'billing',
  'RemindOverdue',
  '--cron',
  '0 9 * * *',
  '--command',
  'RemindInvoices',
  '--term',
  'Overdue=Left unpaid past its due date',
];

describe('generate job, in a project with tenants', () => {
  it('writes a job that runs once per tenant, says so, and proves it on two tenants', () => {
    const root = jobProject('--tenancy', 'shared-table');
    const notes = stringsAt(cli(root, ...REMIND, '--json').json(), 'notes').join('\n');

    expect(read(root, JOB)).toContain(
      "@Scheduled('billing.remind-overdue', { cron: '0 9 * * *', tenancy: 'per-tenant' })",
    );

    expect(notes).toContain("runs per tenant (`tenancy: 'per-tenant'`)");
    expect(read(root, SPEC)).toContain("tenants: ['tenant-a', 'tenant-b'],");
    expect(read(root, SPEC)).toContain("expect(tenants).toEqual(['tenant-a', 'tenant-b']);");
    expect(read(root, SPEC)).toContain('expect(sent).toHaveLength(2);');
  });

  it('writes a global job on --global, and says that no tenant-scoped repository can be read there', () => {
    const root = jobProject('--tenancy', 'shared-table');
    const notes = stringsAt(cli(root, ...REMIND, '--global', '--json').json(), 'notes').join('\n');

    expect(read(root, JOB)).toContain("{ cron: '0 9 * * *', tenancy: 'global' }");
    expect(notes).toContain('is global');
    expect(read(root, SPEC)).not.toContain('tenant-a');
  });

  it('registers the job per tenant where contexts are wired by hand, and tests it with a tenant in the occurrence', () => {
    const root = jobProject('--tenancy', 'shared-table', '--di', 'manual');

    expect(cli(root, ...REMIND).code).toBe(0);

    expect(read(root, `${BILLING}/billing.module.ts`)).toContain(
      "    schedule: { cron: '0 9 * * *' },\n    tenancy: 'per-tenant',\n    run:",
    );

    expect(read(root, SPEC)).toContain("  tenantId: 'tenant-a',\n};");
  });

  it('writes a job without tenancy in a project without tenants, and refuses --global there', () => {
    const root = jobProject();
    const refused = cli(root, ...REMIND, '--global');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('--global means nothing in a project without tenancy');
    expect(cli(root, ...REMIND).code).toBe(0);
    expect(read(root, JOB)).toContain("@Scheduled('billing.remind-overdue', { cron: '0 9 * * *' })");
    expect(read(root, JOB)).not.toContain('tenancy');
  });
});

describe('init, in a project with tenants', () => {
  it.each([[[]], [['--di', 'manual']]])('gives the scheduler the tenants of TENANTS (%j)', (flags) => {
    const root = initProject('--tenancy', 'shared-table', ...flags);
    const config = read(root, 'src/platform/config/load-config.ts');

    expect(config).toContain('tenants: readTenants(env),');
    expect(config).toContain("env.optional('TENANTS')");
    expect(read(root, 'src/platform/config/app-config.ts')).toContain('readonly tenants: readonly string[];');
    expect(read(root, 'src/main.ts')).toContain('tenants: config.tenants,');
    expect(read(root, '.env.example')).toContain('\nTENANTS=\n');

    const bound =
      flags.length === 0
        ? read(root, 'src/platform/composition/compose-application.ts')
        : read(root, 'src/platform/composition/lay-foundations.ts');

    expect(bound).toContain('tenantDirectory(');
    expect(read(root, 'src/platform/composition/tenant-directory.ts')).toContain('new InMemoryTenantDirectory(fixed)');
  });

  it('says nothing of tenants without tenancy', () => {
    const root = initProject();

    expect(read(root, 'src/platform/config/load-config.ts')).not.toContain('TENANTS');
    expect(read(root, 'src/main.ts')).not.toContain('tenants');
  });
});
