import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers';
import { initProject } from './support/init-project';
import { readJson } from './support/read-json';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);
const VERIFY_SCRIPT = 'tsx --env-file-if-exists=.env scripts/audit-verify.ts';

describe('init: the nightly verification of the audit trail', () => {
  it('registers audit.verify every night with the trail on, beside the archive, and switches it off by its variable', () => {
    const root = initProject();

    expect(platform(root, 'audit/audit.module.ts')).toContain(
      "      if (jobs) {\n        builder\n          .job('audit.verify', { cron: '30 4 * * *', tenancy: 'global' })\n" +
        '          .handledByFactory(() => new VerifyAuditTrail(audit.trail));',
    );

    expect(platform(root, 'composition/compose-application.ts')).toContain(
      'auditModule(foundations.audit, { jobs: options.platformJobs !== false }),',
    );

    expect(platform(root, 'jobs/job-settings.ts')).toContain(
      "'audit.verify': { enabled: environment['JOB_AUDIT_VERIFY_ENABLED'] !== 'false' },",
    );
  });

  it('registers it on the scheduler of a hand-wired platform, with or without a storage of files', () => {
    for (const storage of ['local', 'none']) {
      const composition = platform(
        initProject('--di', 'manual', '--orm', 'knex', '--storage', storage),
        'composition/compose-application.ts',
      );

      expect(composition).toContain('  auditJobs(platform);');

      expect(composition).toContain(
        "  platform.jobs.register({ name: 'audit.verify', schedule: { cron: '30 4 * * *' }, run: () => verify.run() });",
      );
    }
  });

  it('writes the script that verifies it by hand with the trail in a database, and nothing of it otherwise', () => {
    const database = initProject();
    const memory = initProject('--orm', 'none', '--audit', 'on');
    const off = initProject('--audit', 'off');

    expect(read(database, 'scripts/audit-verify.ts')).toContain(
      'const verification = await verifyTrail(createAuditTrail(persistence));',
    );

    expect(readJson(database, 'package.json')).toMatchObject({ scripts: { 'audit:verify': VERIFY_SCRIPT } });
    expect(platform(database, 'audit/create-audit-trail.ts')).toContain('export function createAuditTrail(');

    for (const root of [memory, off]) {
      expect(exists(root, 'scripts/audit-verify.ts')).toBe(false);
      expect(read(root, 'package.json')).not.toContain('audit:verify');
    }

    expect(platform(off, 'jobs/job-settings.ts')).not.toContain('audit.verify');
  });
});
