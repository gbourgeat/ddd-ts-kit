import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_STACK, exists, read, scaffoldEverything, type StackFlags, tempDir } from '../helpers';
import { installForReal, type Manager } from './install-for-real';
import { runIn } from './run-in';
import { SLOW } from './stacks';

/** The heaviest install the generator offers: NestJS, class-validator, and Prisma, whose client is generated before every build. */
const HEAVY: StackFlags = {
  http: 'nest',
  validation: 'class-validator',
  di: 'nest',
  tests: 'vitest',
  orm: 'prisma',
  events: 'outbox',
};

const LOCKFILES: Readonly<Record<Manager, string>> = { npm: 'package-lock.json', pnpm: 'pnpm-lock.yaml' };

const only = process.env['DDD_TS_KIT_PACKAGE_MANAGER'];
const managers = (['npm', 'pnpm'] as const).filter((manager) => only === undefined || only === manager);

/** The default stack carries the clients of its contract: workspace packages that the frozen install must accept. */
const WITH_CLIENTS: readonly string[] = ['--sdk'];
const WITHOUT: readonly string[] = [];

const CASES = managers.flatMap((manager) => [
  [manager, 'the default stack with its clients', DEFAULT_STACK, WITH_CLIENTS] as const,
  [manager, 'nest and prisma', HEAVY, WITHOUT] as const,
]);

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): what `init --package-manager` offers is what this suite
 * proves. One project per manager and stack, every kind generated, installed for real by that
 * manager from the packed kit (no link to the workspace, the layout of node_modules is the
 * manager's own), then held to its own scripts, run through the manager: the frozen install of
 * a pipeline, the build, and `verify`, which chains every gate of the baseline.
 * `DDD_TS_KIT_PACKAGE_MANAGER` narrows the run to one manager, which is how the pipeline splits it.
 */
describe.runIf(SLOW).each(CASES)('a project on %s (%s)', (manager, _label, stack, more) => {
  let root: string;
  let frozen: string;

  const script = (name: string): string => runIn(root, { command: manager, args: ['run', name] });

  beforeAll(() => {
    root = tempDir(`on-${manager}`);
    scaffoldEverything(root, stack, ['--package-manager', manager, '--ci', 'both', ...more]);
    frozen = installForReal(root, manager);
  }, 600_000);

  it('installs the kit as published, writes its lockfile and passes the frozen install of a pipeline', () => {
    expect(exists(root, LOCKFILES[manager])).toBe(true);
    expect(exists(root, 'node_modules/ddd-ts-kit/dist/bin.js')).toBe(true);
    expect(exists(root, 'node_modules/@ddd-ts-kit/kernel/dist/index.js')).toBe(true);
    expect(frozen).not.toMatch(/ERR_|EUSAGE/);
    expect(read(root, LOCKFILES[manager]).includes('clients/api')).toBe(more.includes('--sdk'));

    expect(read(root, 'package.json')).toContain(
      manager === 'npm' ? '"npm run typecheck' : `"${manager} run typecheck`,
    );
  });

  it('builds through its own script: the compiler, then the aliases of the output rewritten', () => {
    script('build');

    expect(exists(root, 'dist/src/main.js')).toBe(true);
  }, 240_000);

  it('passes verify, once its derived files are regenerated in one step: types, lint, format, every spec with the coverage thresholds, end to end, architecture, graph, dead code, documents', () => {
    script('regenerate');

    const verified = script('verify');

    expect(verified).toMatch(/Test Files\s+\d+ passed/);
    expect(verified).not.toMatch(/\d+ failed/);
  }, 900_000);

  it('says what a pull request has to run, from the CLI the project installed', () => {
    // npm reads the flags that follow for itself unless told where its own end.
    const exec = manager === 'npm' ? ['exec', '--'] : ['exec'];

    const selection = runIn(root, {
      command: manager,
      args: [...exec, 'ddd-ts-kit', 'affected', '--format', 'github'],
    });

    expect(selection).toContain('scope=all');
  });
});
