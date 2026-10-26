import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { importGenerated } from './support/import-generated';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);

const JOB_LINES = [
  "'billing.send-reminders': { enabled: environment['JOB_BILLING_SEND_REMINDERS_ENABLED'] !== 'false' },",
  "'shipping.close-parcels': { timeoutMs: 1000 },",
];

describe('scheduled jobs in the platform', () => {
  it('validates RUN_JOBS with the rest of the configuration, on by default', () => {
    const root = initProject();

    expect(platform(root, 'config/app-config.ts')).toContain('readonly runJobs: boolean;');

    expect(platform(root, 'config/load-config.ts')).toContain("runJobs: env.flag('RUN_JOBS', runJobsByDefault),");

    expect(platform(root, 'config/load-config.ts')).toContain(
      '// ddd-ts-kit:run-jobs\nconst runJobsByDefault = true;\n// /ddd-ts-kit:run-jobs',
    );

    expect(platform(root, 'config/environment.ts')).toContain('this.problem(`${name} must be true or false`);');

    expect(read(root, '.env.example')).toContain('# RUN_JOBS=true');
    expect(read(root, '.env.example')).toContain('JOB_<CONTEXT>_<JOB>_ENABLED=false');
  });

  it.each([[[]], [['--di', 'manual']], [['--http', 'nest']], [['--http', 'none']]])(
    'tells the application whether this process runs the jobs, and their settings (%j)',
    (flags) => {
      const root = initProject(...flags);

      expect(read(root, 'src/main.ts')).toContain(
        'jobs: { start: config.runJobs, settings: jobSettings(process.env) },',
      );

      expect(read(root, 'src/main.ts')).toContain("import { jobSettings } from '@/platform/jobs/job-settings';");
    },
  );

  it('starts no job by time where nothing asks for it: the tools and the tests', () => {
    const root = initProject();

    expect(platform(root, 'composition/compose-application.ts')).toContain('jobs: options.jobs ?? { start: false },');
    expect(read(root, 'scripts/openapi.ts')).not.toContain('jobs');
    expect(read(root, 'test/e2e/support/start-application.ts')).not.toContain('jobs');
  });

  it('keeps one marker region for the settings of the jobs, in a file that needs no helper', () => {
    const settings = platform(initProject(), 'jobs/job-settings.ts');

    expect(settings).toContain(
      'export function jobSettings(environment: Environment, context?: string): Readonly<Record<string, JobSettings>> {',
    );

    expect(settings).toContain(
      "  const settings: Readonly<Record<string, JobSettings>> = {\n    // Off while the files are on the disk of the server, since an archive removes the entries from the\n    // database: JOB_AUDIT_ARCHIVE_ENABLED=true once that disk is durable and backed up.\n    'audit.archive': { enabled: environment['JOB_AUDIT_ARCHIVE_ENABLED'] === 'true' },\n    'privacy.purge-expired': { enabled: environment['JOB_PRIVACY_PURGE_EXPIRED_ENABLED'] !== 'false' },\n    // ddd-ts-kit:jobs\n    // /ddd-ts-kit:jobs\n  };",
    );

    expect(settings.match(/^import /gm)).toHaveLength(1);
    expect(settings).toContain("import type { JobSettings } from '@ddd-ts-kit/kernel';");
  });

  it('switches one job off by its variable, and leaves the others as they were declared', async () => {
    const root = initProject();

    expect(await settingsOf(root, {})).toEqual({
      'audit.archive': { enabled: false },
      'privacy.purge-expired': { enabled: true },
      'billing.send-reminders': { enabled: true },
      'shipping.close-parcels': { timeoutMs: 1000 },
    });

    expect(
      jsonAt(await settingsOf(root, { JOB_BILLING_SEND_REMINDERS_ENABLED: 'false' }), 'billing.send-reminders'),
    ).toEqual({ enabled: false });
  });

  it('gives a context run alone the settings of its own jobs only', async () => {
    const root = initProject();

    expect(await settingsOf(root, {}, 'shipping')).toEqual({ 'shipping.close-parcels': { timeoutMs: 1000 } });
    expect(await settingsOf(root, {}, 'catalog')).toEqual({});
  });
});

describe('the lock that keeps a job to one instance', () => {
  it('is the Redis lock with --cache redis, bound to the port of the kernel', () => {
    const root = initProject('--cache', 'redis');

    expect(platform(root, 'redis/open-redis.ts')).toContain(
      "lock: new RedisLock(connection.client, { namespace: deploymentName + ':lock' }),",
    );

    expect(platform(root, 'composition/platform.module.ts')).toContain('builder.rebind(Lock).toValue(redis.lock);');
    expect(read(root, 'README.md')).toContain('the kernel `Lock` is bound to `RedisLock`');
    expect(read(root, 'README.md')).not.toContain('Limitation: one instance runs the jobs');
  });

  it('is the one of the process otherwise, and the README says what that limits', () => {
    const root = initProject();

    expect(platform(root, 'composition/platform.module.ts')).not.toContain('Lock');
    expect(read(root, 'README.md')).toContain('**Limitation: one instance runs the jobs.**');
    expect(read(root, 'README.md')).toContain('`--cache redis`, which binds `RedisLock`');
  });

  it('reaches the scheduler of a hand-wired platform the same way', () => {
    const byHand = initProject('--di', 'manual', '--cache', 'redis');

    expect(platform(byHand, 'composition/lay-foundations.ts')).toContain(
      'const lock = options.redis?.lock ?? new InMemoryLock(clock);',
    );

    expect(platform(initProject('--di', 'manual'), 'composition/lay-foundations.ts')).toContain(
      '// TODO(platform): this lock excludes inside one process only.',
    );
  });
});

describe('the proof that a context is extractable', () => {
  it.each([
    [[], 'application.describe().jobs.map((job) => job.name)'],
    [['--style', 'explicit'], 'application.jobs.scheduler.describe().map((job) => job.name)'],
    [['--di', 'manual'], "platform.jobs.describe().filter((job) => !job.name.startsWith(name + '.'))"],
  ])('lists the jobs of a context booted alone (%j)', (flags, expected) => {
    const root = initProject(...flags, '--context', 'billing:core');
    const proof = read(root, 'test/architecture/extractable.spec.ts');

    expect(proof).toContain("it.each(contexts)('%s takes its scheduled jobs with it, and no job of another context'");
    expect(proof).toContain(expected);
    expect(cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting').code).toBe(0);
    expect(read(root, 'test/architecture/extractable.spec.ts')).toMatch(/\['shipping', .+\],/);
  });
});

async function settingsOf(root: string, ...parameters: readonly unknown[]): Promise<unknown> {
  const jobSettings: unknown = jsonAt(await importGenerated(root, withJobs(root)), 'jobSettings');

  if (typeof jobSettings !== 'function') {
    throw new Error('job-settings.ts exports no jobSettings function.');
  }

  const settings: unknown = Reflect.apply(jobSettings, undefined, parameters);

  return settings;
}

/** The settings file of a project as `generate job` leaves it: one line per job inside the marker region. */
function withJobs(root: string): string {
  const file = 'src/platform/jobs/job-settings.ts';

  write(
    root,
    file,
    read(root, file).replace(
      '    // /ddd-ts-kit:jobs',
      `${JOB_LINES.map((line) => `    ${line}`).join('\n')}\n    // /ddd-ts-kit:jobs`,
    ),
  );

  return file;
}
