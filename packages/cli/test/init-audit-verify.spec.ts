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
        '          .handledByFactory((resolve) => new VerifyAuditTrail(audit.trail, resolve(FileStorage)));',
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

      expect(composition).toContain(
        storage === 'none'
          ? 'const verify = new VerifyAuditTrail(platform.audit.trail);'
          : 'const verify = new VerifyAuditTrail(platform.audit.trail, platform.files.storage);',
      );
    }
  });

  it('writes the job and the script with the trail in a database, and neither for a trail in memory or no trail', () => {
    const database = initProject();
    const memory = initProject('--orm', 'none', '--audit', 'on');
    const off = initProject('--audit', 'off');

    expect(read(database, 'scripts/audit-verify.ts')).toContain(
      'const verification = await verifyTrail(createAuditTrail(persistence), { files: openFiles(config.files) });',
    );

    expect(read(initProject('--storage', 'none'), 'scripts/audit-verify.ts')).toContain(
      'const verification = await verifyTrail(createAuditTrail(persistence));',
    );

    expect(readJson(database, 'package.json')).toMatchObject({ scripts: { 'audit:verify': VERIFY_SCRIPT } });
    expect(platform(database, 'audit/create-audit-trail.ts')).toContain('export function createAuditTrail(');

    for (const root of [memory, off]) {
      expect(exists(root, 'scripts/audit-verify.ts')).toBe(false);
      expect(read(root, 'package.json')).not.toContain('audit:verify');
      expect(platform(root, 'jobs/job-settings.ts')).not.toContain('audit.verify');
    }

    expect(platform(memory, 'audit/audit.module.ts')).not.toContain('VerifyAuditTrail');
    expect(platform(memory, 'composition/compose-application.ts')).toContain('      auditModule(foundations.audit),');
    expect(read(memory, 'README.md')).toContain('nothing verifies them by night');
  });
});
