import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';

const PROOF = 'test/architecture/hosting.spec.ts';

/** A project with shipping run as a service, on the given flags. */
function withShippingService(...flags: string[]): string {
  const root = initProject('--audit', 'on', '--privacy', 'on', ...flags);

  expect(cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting').code).toBe(0);
  expect(cli(root, 'generate', 'service', 'shipping').code).toBe(0);

  return root;
}

describe('a service and the jobs of the platform', () => {
  it.each([[[]], [['--di', 'manual']]])('composes without them, and a proof holds it to that (%j)', (flags) => {
    const root = withShippingService(...flags);

    expect(read(root, 'src/apps/shipping/main.ts')).toContain('    platformJobs: false,\n');
    expect(read(root, PROOF)).toContain("  // ddd-ts-kit:extracted\n  'shipping',\n");
    expect(read(root, PROOF)).toContain("toContain('platformJobs: false')");
  });

  it('registers the jobs of the platform only where the option leaves them on', () => {
    const root = withShippingService();

    expect(read(root, 'src/platform/composition/compose-application.ts')).toContain(
      'privacyModule({ jobs: options.platformJobs !== false })',
    );

    expect(read(root, 'src/platform/privacy/privacy.module.ts')).toContain('if (jobs) {');
    expect(read(root, 'src/platform/audit/audit.module.ts')).toContain('if (jobs) {');
  });

  it('registers them only where the option leaves them on, on a platform wired by hand', () => {
    const root = withShippingService('--di', 'manual');

    expect(read(root, 'src/platform/composition/compose-application.ts')).toContain(
      'function registerPlatformJobs(platform: Platform, options: ApplicationOptions): void {\n  if (options.platformJobs === false) {\n    return;\n  }',
    );
  });

  it('keeps the keys the processes of one deployment share under the name of the deployment, not of the container', () => {
    const root = initProject('--cache', 'redis');

    expect(read(root, 'src/platform/config/load-config.ts')).toContain(
      "deploymentName: env.optional('DEPLOYMENT_NAME') ?? ",
    );

    const redis = read(root, 'src/platform/redis/open-redis.ts');

    expect(redis).toContain("lock: new RedisLock(connection.client, { namespace: deploymentName + ':lock' }),");
    expect(redis).not.toContain('serviceName');
    expect(read(root, '.env.example')).toContain('\nDEPLOYMENT_NAME=');
  });
});
