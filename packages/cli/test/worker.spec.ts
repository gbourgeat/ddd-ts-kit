import { describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';
import { readJson } from './support/read-json.js';
import { stringsAt } from './support/strings-at.js';
import { textsAt } from './support/texts-at.js';

const WORKER = 'src/apps/worker/main.ts';

describe('generate worker', () => {
  it('writes an entry point with the modules of main.ts, no HTTP server, and the jobs started whatever RUN_JOBS says', () => {
    const worker = read(withWorker(), WORKER);

    expect(worker.split('\n')[1]).toBe("import { tracing } from '../../platform/tracing.js';");
    expect(worker).toContain("import { composeApplication } from '../../platform/compose-application.js';");
    expect(worker).toContain('jobs: { start: true, settings: jobSettings(process.env) },');
    expect(worker).toContain('authenticator: createAuthenticator(config),');
    expect(worker).not.toContain('startHttpServer');
    expect(worker).not.toContain('startOutboxRelay');
    expect(worker).not.toContain('config.runJobs');
  });

  it('stops gracefully: the application first, which waits for the runs in progress, then what it was built on', () => {
    const worker = read(withWorker('--cache', 'redis'), WORKER);

    expect(worker).toContain("process.once('SIGTERM', () => void shutdown());");

    expect(worker).toContain(
      '  await application.stop();\n  await redis.close();\n  await persistence.close();\n  await tracing.shutdown();',
    );

    expect(worker).toContain('  redis,\n});');
  });

  it('adds the start script, the compose service and the entry knip needs', () => {
    const root = withWorker();

    expect(textsAt(readJson(root, 'package.json'), 'scripts')['start:worker']).toBe(
      'node dist/src/apps/worker/main.js',
    );

    expect(read(root, 'docker-compose.yml')).toContain(
      '\n  worker:\n    build:\n      context: .\n      args:\n        ENTRY: dist/src/apps/worker/main.js\n    profiles: [services]\n    env_file: .env\n    environment:\n      RUN_JOBS: "true"\n',
    );

    expect(read(root, 'docker-compose.yml').indexOf('\n  worker:')).toBeLessThan(
      read(root, 'docker-compose.yml').indexOf('\nvolumes:'),
    );

    expect(stringsAt(readJson(root, 'knip.json'), 'entry')).toContain('src/apps/*/main.ts');
    expect(read(root, '.dependency-cruiser.cjs')).toContain('^src/apps/[^/]+/main\\\\.ts$');
  });

  it('records the worker in the config and starts the API with its jobs off', () => {
    const root = withWorker();

    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'worker')).toBe(true);

    expect(read(root, 'src/platform/config/load-config.ts')).toContain(
      '// ddd-ts-kit:run-jobs\nconst runJobsByDefault = false;\n// /ddd-ts-kit:run-jobs',
    );

    expect(read(root, 'src/main.ts')).toContain('jobs: { start: config.runJobs, settings: jobSettings(process.env) },');
  });

  it('says how to start it, and what several instances need', () => {
    const notes = (root: string): string =>
      stringsAt(cli(root, 'generate', 'worker', '--json').json(), 'notes').join('\n');

    expect(notes(initProject())).toContain('npm run start:worker');

    expect(notes(initProject())).toContain(
      'Run ONE worker: without `--cache redis` the lock is in the memory of each process',
    );

    expect(notes(initProject('--cache', 'redis'))).toContain(
      'Several workers may run: the Redis lock of the platform keeps an occurrence of a job to one of them',
    );
  });

  it.each([
    [['--di', 'manual']],
    [['--http', 'nest']],
    [['--http', 'none', '--orm', 'none']],
    [['--style', 'explicit', '--broker', 'nats']],
  ])('serves every family and stack (%j)', (flags) => {
    const worker = read(withWorker(...flags), WORKER);

    expect(worker).toContain('jobs: { start: true, settings: jobSettings(process.env) },');
    expect(worker.includes('createAuthenticator(config)')).toBe(!flags.includes('none'));
  });
});

describe('generate worker, run again and refused', () => {
  it('is written once: a second run changes nothing', () => {
    const root = withWorker();

    const before = [
      WORKER,
      'package.json',
      'docker-compose.yml',
      'knip.json',
      'ddd-ts-kit.config.json',
      'src/platform/config/load-config.ts',
    ].map((file) => read(root, file));

    const again = cli(root, 'generate', 'worker', '--json');

    expect(again.code).toBe(0);
    expect(stringsAt(again.json(), 'skipped')).toEqual([WORKER]);

    expect(
      [
        WORKER,
        'package.json',
        'docker-compose.yml',
        'knip.json',
        'ddd-ts-kit.config.json',
        'src/platform/config/load-config.ts',
      ].map((file) => read(root, file)),
    ).toEqual(before);
  });

  it('survives a new init --force: the script, the knip entry and the default of RUN_JOBS follow the config', () => {
    const root = withWorker();

    expect(cli(root, 'init', '--force').code).toBe(0);

    expect(textsAt(readJson(root, 'package.json'), 'scripts')['start:worker']).toBe(
      'node dist/src/apps/worker/main.js',
    );

    expect(stringsAt(readJson(root, 'knip.json'), 'entry')).toContain('src/apps/*/main.ts');
    expect(read(root, 'src/platform/config/load-config.ts')).toContain('const runJobsByDefault = false;');
    expect(read(root, '.env.example')).toContain('# RUN_JOBS=false');
    expect(read(root, 'docker-compose.yml')).toContain('\n  worker:\n    build:');
    expect(read(root, 'README.md')).toContain('`false` by default: the worker runs them');
  });

  it('refuses to share its entry point with a context named worker, and takes no argument', () => {
    const root = initProject('--context', 'worker:generic');
    const refused = cli(root, 'generate', 'worker', '--json');

    expect(refused.code).toBe(2);
    expect(String(jsonAt(refused.json(), 'error', 'fix'))).toContain('rename the context');
    expect(exists(root, WORKER)).toBe(false);
    expect(cli(initProject(), 'generate', 'worker', 'billing').code).toBe(2);
  });
});

describe('generate service', () => {
  it.each([
    [[], "{ modules: [contextModule('billing', billingDeclarations)], routes: [billingRoutes] }"],
    [
      ['--assembly', 'discovery', '--broker', 'rabbitmq'],
      "{\n    modules: [await discoverContext('billing', new URL('../../contexts/billing/', import.meta.url))],\n    routes: [billingRoutes],\n  }",
    ],
    [['--style', 'explicit'], '{ modules: [billingModule], routes: [billingRoutes] }'],
    [['--http', 'none'], "{ modules: [contextModule('billing', billingDeclarations)] }"],
    [['--di', 'manual'], '[billingModule]'],
  ])('composes one context with its jobs, and only its own (%j)', (flags, selection) => {
    const root = initProject(...flags, '--context', 'billing:core');

    expect(cli(root, 'generate', 'service', 'billing').code).toBe(0);

    const service = read(root, 'src/apps/billing/main.ts');

    expect(service).toContain(`  ${selection},\n);`);
    expect(service).toContain("jobs: { start: config.runJobs, settings: jobSettings(process.env, 'billing') },");
    expect(service).not.toContain('publishers');
    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'contexts', 'billing', 'deployable')).toBe(true);

    expect(textsAt(readJson(root, 'package.json'), 'scripts')['start:billing']).toBe(
      'node dist/src/apps/billing/main.js',
    );
  });

  it('imports what its selection names, from the context and nowhere else', () => {
    const root = initProject('--context', 'billing:core');

    cli(root, 'generate', 'service', 'billing');
    const service = read(root, 'src/apps/billing/main.ts');

    expect(service).toContain("import { contextModule } from '@ddd-ts-kit/di';");
    expect(service).toContain("import * as billingDeclarations from '../../contexts/billing/billing.declarations.js';");

    expect(service).toContain(
      "import { billingRoutes } from '../../contexts/billing/presentation/http/billing.routes.js';",
    );

    expect(read(root, 'docker-compose.yml')).toContain('\n  billing:\n');
  });
});

function withWorker(...flags: readonly string[]): string {
  const root = initProject(...flags);
  const result = cli(root, 'generate', 'worker');

  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout);
  }

  return root;
}
