import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';
import { stringsAt } from './support/strings-at';

const COMPOSITION = 'src/platform/composition/compose-application.ts';
const SETTINGS = 'src/platform/jobs/job-settings.ts';
const PROOF = 'test/architecture/hosting.spec.ts';

/** A project with billing and shipping, shipping run as a service; the notes of the command. */
function withShippingService(...flags: string[]): { root: string; notes: string } {
  const root = initProject(...flags);

  expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);
  expect(cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting').code).toBe(0);

  return { root, notes: stringsAt(cli(root, 'generate', 'service', 'shipping', '--json').json(), 'notes').join('\n') };
}

describe('generate service, for the whole application', () => {
  it('takes the context out of what the application hosts, keeps the full list, and has the entry points compose the hosted ones', () => {
    const { root, notes } = withShippingService();
    const composition = read(root, COMPOSITION);

    expect(composition).toContain(
      "const extractedModules: readonly string[] = [\n  // ddd-ts-kit:extracted\n  'shipping',\n",
    );

    expect(composition).toContain('export const hostedContexts: ContextSelection = {');
    expect(composition).toContain('export const everyContext: ContextSelection = {');

    expect(composition).toContain(
      '  modules: everyContext.modules.filter((module) => !extractedModules.includes(module.name)),',
    );

    expect(read(root, 'src/main.ts')).toContain('  hostedContexts,\n);');
    expect(read(root, 'src/apps/shipping/main.ts')).not.toContain('hostedContexts');
    expect(read(root, SETTINGS)).toContain("  // ddd-ts-kit:extracted\n  'shipping',\n");
    expect(notes).toContain('Shipping leaves the application of src/main.ts and the worker');
  });

  it('takes the routes of the context out too, where they are a list of functions', () => {
    const { root } = withShippingService('--routes', 'functions');

    expect(read(root, COMPOSITION)).toContain('  shippingRoutes,\n  // /ddd-ts-kit:extracted-routes');

    expect(read(root, COMPOSITION)).toContain(
      '(everyContext.routes ?? []).filter((routes) => !extractedRoutes.includes(routes))',
    );
  });

  it('leaves the jobs of the platform to the whole application, and tells the shared deployment name apart from the service name', () => {
    const { root, notes } = withShippingService('--audit', 'on', '--privacy', 'on');
    const service = read(root, 'src/apps/shipping/main.ts');

    expect(service).toContain('    platformJobs: false,\n');
    expect(service).toContain("jobSettings(process.env, 'shipping')");
    expect(read(root, SETTINGS)).toContain("!extracted.some((hosted) => name.startsWith(hosted + '.'))");
    expect(read(root, 'src/platform/privacy/privacy.module.ts')).toContain('{ jobs = true }');
    expect(notes).toContain('no job of another context nor of the platform');
    expect(notes).toContain('Set the same DEPLOYMENT_NAME in every container');
  });

  it('writes the proof that composes both roots, once, and lists every service in it', () => {
    const { root } = withShippingService();

    expect(cli(root, 'generate', 'service', 'billing').code).toBe(0);

    const proof = read(root, PROOF);

    expect(proof).toContain("  // ddd-ts-kit:extracted\n  'shipping',\n  'billing',\n");
    expect(proof).toContain('composeApplication(inertPersistence(), options, hostedContexts).container.describe()');
    expect(proof).toContain("toContain('platformJobs: false')");
  });

  it('does the same where the contexts are wired by hand, by the identity of the module', () => {
    const { root } = withShippingService('--di', 'manual');
    const composition = read(root, COMPOSITION);

    expect(composition).toContain(
      'const extracted: readonly ContextModule[] = [\n  // ddd-ts-kit:extracted\n  shippingModule,\n',
    );

    expect(composition).toContain('export const hostedContexts: readonly ContextModule[] = everyContext.filter(');
    expect(read(root, PROOF)).toContain('application.platform.jobs.describe()');
    expect(read(root, 'src/apps/shipping/main.ts')).toContain('platformJobs: false,');
  });
});
