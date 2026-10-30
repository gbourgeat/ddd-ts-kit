import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers';
import { importGenerated } from './support/import-generated';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);

const BY_HAND = ['--di', 'manual', '--orm', 'knex'];
const NO_OUTBOX = ['--events', 'in-memory', '--allow-no-outbox', 'One process, one database.'];

describe('what the platform is done with, purged every night', () => {
  it('schedules both purges in a module on tsyringe', () => {
    const root = initProject();
    const module = platform(root, 'jobs/housekeeping.module.ts');

    expect(module).toContain("builder.job('events.purge-published', { cron: '30 3 * * *', tenancy: 'global' })");
    expect(module).toContain('await resolve(OutboxStore).purgePublished(');
    expect(module).toContain("builder.job('jobs.purge-finished', { cron: '45 3 * * *', tenancy: 'global' })");
    expect(module).toContain('await resolve(JobStore).purgeFinished(');

    expect(platform(root, 'composition/compose-application.ts')).toContain(
      'housekeepingModule(options.housekeeping ?? DEFAULT_HOUSEKEEPING, { jobs: options.platformJobs !== false }),',
    );
  });

  it('schedules them on the platform wired by hand, which hands on the job store', () => {
    const root = initProject(...BY_HAND);
    const composed = platform(root, 'composition/compose-application.ts');

    expect(exists(root, 'src/platform/jobs/housekeeping.module.ts')).toBe(false);
    expect(composed).toContain("name: 'events.purge-published',");
    expect(composed).toContain('await platform.persistence.outbox.purgePublished(');
    expect(composed).toContain("name: 'jobs.purge-finished',");
    expect(composed).toContain('await platform.jobStore.purgeFinished(');
    expect(platform(root, 'jobs/create-background-work.ts')).toContain('jobStore: store,');
  });

  it('keeps what it is told, thirty days unless the environment says otherwise, and every process that runs the jobs reads it', () => {
    const root = initProject();

    expect(platform(root, 'config/load-config.ts')).toContain(
      "publishedEventsDays: days('OUTBOX_RETENTION_DAYS', DEFAULT_HOUSEKEEPING.publishedEventsDays),",
    );

    expect(platform(root, 'config/load-config.ts')).toContain(
      "finishedJobsDays: days('BACKGROUND_JOBS_RETENTION_DAYS', DEFAULT_HOUSEKEEPING.finishedJobsDays),",
    );

    expect(read(root, '.env.example')).toContain('# OUTBOX_RETENTION_DAYS=30');
    expect(read(root, '.env.example')).toContain('# BACKGROUND_JOBS_RETENTION_DAYS=30');
    expect(read(root, 'src/main.ts')).toContain('housekeeping: config.housekeeping,');
  });

  it('counts the days from the clock of the platform', async () => {
    const generated = await importGenerated(initProject(), 'src/platform/jobs/days-before.ts');
    const daysBefore: unknown = jsonAt(generated, 'daysBefore');
    const clock = { now: () => new Date('2026-03-31T10:00:00.000Z') };

    if (typeof daysBefore !== 'function') {
      throw new Error('days-before.ts exports no daysBefore function.');
    }

    expect(Reflect.apply(daysBefore, undefined, [clock, 30])).toEqual(new Date('2026-03-01T10:00:00.000Z'));
  });

  it('switches each one off in one environment, and purges only what leaves the memory of the process', () => {
    const settings = platform(initProject(...NO_OUTBOX), 'jobs/job-settings.ts');
    const inMemory = initProject(...NO_OUTBOX, '--queue', 'memory', '--storage', 'none', '--privacy', 'off');

    expect(settings).not.toContain('events.purge-published');
    expect(settings).toContain("environment['JOB_JOBS_PURGE_FINISHED_ENABLED'] !== 'false'");

    expect(exists(inMemory, 'src/platform/jobs/housekeeping.ts')).toBe(false);
    expect(platform(inMemory, 'jobs/job-settings.ts')).not.toContain('jobs.purge-finished');
    expect(platform(inMemory, 'config/load-config.ts')).not.toContain('housekeeping');
  });
});
