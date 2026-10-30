import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { ON_A_SERVER } from './pipeline/monorepo/affected-packages.mjs';

/**
 * The spec files measured over twenty seconds in a full run (2026-10-23, longest first): started
 * first, so that a run does not end waiting on one of them. The runner orders the others by the
 * durations it cached, or by their size when it has none, as on a runner of the pipeline.
 */
const SLOW_FIRST = [
  'packages/kernel/test/declarations.spec.ts',
  'packages/aspects/test/decorators.spec.ts',
  'packages/http/test/controllers.spec.ts',
  'packages/di/test/discovered-context.spec.ts',
];

class SlowFirstSequencer extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const rank = (spec: TestSpecification): number => {
      const index = SLOW_FIRST.findIndex((file) => spec.moduleId.endsWith(file));

      return index === -1 ? SLOW_FIRST.length : index;
    };

    return [...(await super.sort(files))].sort((a, b) => rank(a) - rank(b));
  }
}

/**
 * The floor of each package, as [statements, branches, functions, lines]: what the unit run measured
 * on 2026-10-30, rounded down, so that the coverage of a package cannot fall without the gate saying
 * so. Lines stand at 100: every line of the sources runs under the unit specs, or is left out by a
 * comment that cites docs/adr/0001-lines-left-out-of-the-coverage-measure.md. A 100 leaves no margin
 * on purpose: a new line comes with its spec. It says that a line ran, not that each case did: the
 * branches keep their own floor. A floor is raised when the package gains tests, never lowered to
 * make a change pass.
 * rabbitmq, nats, kafka, s3 and redis run the same specs on a server the test holds itself (an AMQP
 * broker in memory, a NATS server, an S3 server and a Redis server in their own process, a Kafka
 * cluster in memory), so this run measures them whole; the integration job runs them on a real
 * server too.
 */
const FLOORS: Readonly<Record<string, readonly [number, number, number, number]>> = {
  aspects: [99, 97, 99, 100],
  audit: [100, 95, 100, 100],
  auth: [99, 96, 99, 100],
  cli: [99, 92, 99, 100],
  di: [100, 96, 100, 100],
  drizzle: [100, 94, 100, 100],
  'eslint-plugin': [100, 93, 100, 100],
  events: [100, 94, 100, 100],
  http: [99, 95, 99, 100],
  kafka: [100, 96, 100, 100],
  kernel: [99, 96, 99, 100],
  knex: [100, 94, 100, 100],
  nats: [100, 98, 100, 100],
  openfga: [100, 98, 100, 100],
  pino: [100, 91, 100, 100],
  prisma: [100, 95, 100, 100],
  rabbitmq: [100, 99, 100, 100],
  redis: [99, 94, 98, 100],
  s3: [100, 87, 100, 100],
  scheduling: [99, 97, 98, 100],
  sentry: [100, 99, 100, 100],
  testing: [99, 97, 99, 100],
  tracing: [100, 92, 96, 100],
  typeorm: [100, 95, 100, 100],
  validation: [99, 95, 98, 100],
  winston: [98, 95, 97, 100],
};

/**
 * A pull request runs the specs of the packages its change reaches and of the packages that
 * depend on them (`pipeline/monorepo/affected-packages.mjs`, handed over as KIT_AFFECTED): those
 * are measured and held to their floor, which the same specs give them in a run of everything.
 * Unset, every package is: that is the default branch, the nightly run and a laptop.
 */
const AFFECTED = (process.env['KIT_AFFECTED'] ?? '').split(',').filter((name) => name !== '');
const MEASURED = Object.entries(FLOORS).filter(([name]) => AFFECTED.length === 0 || AFFECTED.includes(name));

/**
 * The integration job measures too (KIT_COVERAGE=integration): what its specs on a server reach in the
 * packages that have some, with no floor, since it runs a few spec files of each. Codecov adds that
 * report to the one of the unit run, so a line covered by either counts. Its own directory: the unit
 * report is not touched.
 */
const INTEGRATION = process.env['KIT_COVERAGE'] === 'integration';

const ENTRY_POINTS = ['packages/cli/src/bin.ts', 'packages/cli/src/refresh-declarations.ts'];
const MEASURED_SOURCES = INTEGRATION ? ON_A_SERVER : AFFECTED;

/**
 * A spec that imports a sibling package reaches its sources, never its `dist`: what a spec of knex
 * runs in the kernel is measured in `packages/kernel/src`, and no package has to be built before
 * the specs of another run on its latest code. Each entry of the exports map of a package names
 * the source file its `dist` file is compiled from; the longest specifier comes first, so that
 * `@ddd-ts-kit/kernel` never catches `@ddd-ts-kit/kernel/testing`.
 */
interface Manifest {
  readonly name: string;
  readonly exports?: Readonly<Record<string, { readonly default: string }>>;
}

const PACKAGES = fileURLToPath(new URL('packages', import.meta.url));

function sourcesOfTheSiblingPackages(): { find: string; replacement: string }[] {
  const aliases = readdirSync(PACKAGES).flatMap((folder) => {
    const manifest = JSON.parse(readFileSync(path.join(PACKAGES, folder, 'package.json'), 'utf8')) as Manifest;

    return Object.entries(manifest.exports ?? {}).map(([entry, target]) => {
      const find = entry === '.' ? manifest.name : `${manifest.name}/${entry.slice(2)}`;
      const source = target.default.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, '.ts');

      return { find, replacement: path.join(PACKAGES, folder, source) };
    });
  });

  return aliases.sort((left, right) => right.find.length - left.find.length);
}

/**
 * A developer machine shares its cores with the editor, the coding agents and their worktrees: the
 * specs take half of them (VITEST_MAX_WORKERS, read by the runner, sets another number). A pipeline
 * runner has its own. Measured in docs/proposals/build-and-test-velocity.md: half the workers cost
 * 14 percent of wall time and saved 40 percent of memory on a 20-core workstation.
 */
const WORKERS = process.env['CI'] ? {} : { maxWorkers: '50%' };

/**
 * Git hands its hooks the repository they run for: in a worktree, a pre-push hook gets GIT_DIR. Inherited
 * by the specs, every git command they run in a throwaway repository would act on this one instead.
 */
const REPOSITORY_OF_THE_CALLER = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_PREFIX'];

for (const name of REPOSITORY_OF_THE_CALLER) {
  Reflect.deleteProperty(process.env, name);
}

export default defineConfig({
  resolve: { alias: sourcesOfTheSiblingPackages() },
  test: {
    include: ['packages/*/test/**/*.spec.ts'],
    // Every file runs at once on a laptop, its PGlite databases and child compilers included: a
    // spec slowed by its neighbours is not a failing one, and a spec that hangs still fails.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    ...WORKERS,
    sequence: { sequencer: SlowFirstSequencer },
    coverage: {
      provider: 'v8',
      include:
        MEASURED_SOURCES.length === 0
          ? ['packages/*/src/**']
          : MEASURED_SOURCES.map((name) => `packages/${name}/src/**`),
      // The two entry points of the CLI run as a process and are never imported: one call each, which the
      // end-to-end specs run from the built package. Left out rather than counted at zero.
      exclude: [...coverageConfigDefaults.exclude, ...ENTRY_POINTS],
      reporter: INTEGRATION ? ['text-summary', 'lcov'] : ['text', 'cobertura', 'lcov'],
      reportsDirectory: INTEGRATION ? 'coverage/integration' : 'coverage',
      thresholds: INTEGRATION
        ? {}
        : Object.fromEntries(
            MEASURED.map(([name, [statements, branches, functions, lines]]) => [
              `packages/${name}/src/**`,
              { statements, branches, functions, lines },
            ]),
          ),
    },
  },
});
