import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers';
import { initProject } from './support/init-project';
import { readJson } from './support/read-json';
import { textsAt } from './support/texts-at';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);

const BY_HAND = ['--di', 'manual', '--orm', 'knex'];

describe('the purge of what outlived its retention, every night', () => {
  it('schedules privacy.purge-expired in the privacy module on tsyringe, and on the platform wired by hand', () => {
    const tsyringe = initProject();
    const byHand = initProject(...BY_HAND);

    expect(platform(tsyringe, 'privacy/privacy.module.ts')).toContain(
      "builder.job('privacy.purge-expired', { cron: '0 3 * * *' })",
    );

    expect(platform(tsyringe, 'composition/compose-application.ts')).toContain(
      '      privacyModule({ jobs: options.platformJobs !== false }),\n',
    );

    expect(exists(byHand, 'src/platform/privacy/privacy.module.ts')).toBe(false);
    expect(platform(byHand, 'composition/compose-application.ts')).toContain("    name: 'privacy.purge-expired',");

    expect(platform(tsyringe, 'jobs/job-settings.ts')).toContain(
      "    'privacy.purge-expired': { enabled: environment['JOB_PRIVACY_PURGE_EXPIRED_ENABLED'] !== 'false' },",
    );
  });

  it('purges every copy that purges, audited when the trail is on, and runs by hand as privacy:purge', () => {
    const audited = initProject();
    const unaudited = initProject('--audit', 'off');

    expect(platform(audited, 'privacy/run-purge.ts')).toContain(
      'const retentions = dataSubjectCopies.map((copy) => resolve(copy)).filter(isPersonalDataRetention);',
    );

    expect(platform(audited, 'privacy/run-purge.ts')).toContain('auditedPersonalDataRetention(port, trail, source);');

    expect(platform(unaudited, 'privacy/run-purge.ts')).toContain(
      '  return purgeExpiredPersonalData(clock.now(), retentions);',
    );

    expect(textsAt(readJson(audited, 'package.json'), 'scripts')).toMatchObject({
      'privacy:purge': 'tsx --env-file-if-exists=.env scripts/privacy-purge.ts',
    });

    expect(read(audited, 'scripts/privacy-purge.ts')).toContain(
      '.run(context, () => runPurge(application.container.resolve));',
    );

    expect(read(initProject('--privacy', 'off'), 'src/platform/jobs/job-settings.ts')).not.toContain(
      'privacy.purge-expired',
    );
  });
});
