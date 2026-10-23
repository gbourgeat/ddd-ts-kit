import { defineConfig } from 'vitest/config';
import { ON_A_SERVER } from './pipeline/monorepo/affected-packages.mjs';

/**
 * The floor of each package, as [statements, branches, functions, lines]: what the unit run measured
 * on 2026-10-10 (2026-10-18 for cli, kernel, knex, prisma, sentry and testing, 2026-10-19 for
 * rabbitmq, nats and kafka, 2026-10-23 for s3), rounded down, so that the coverage of a package cannot fall without
 * the gate saying so. The statements and lines of sentry, measured at 100, are held at 99: a floor
 * of 100 would leave no line of margin. A floor is raised when the package gains tests, never
 * lowered to make a change pass.
 * redis is low on purpose of the measure, not of the code: most of its specs need a server
 * (Dragonfly) and run in the integration job, which this run skips. rabbitmq, nats, kafka and s3
 * run the same specs on a server the test holds itself (an AMQP broker in memory, a NATS server in
 * its own process, a Kafka cluster in memory, an S3 server in its own process), so this run
 * measures them whole.
 */
const FLOORS: Readonly<Record<string, readonly [number, number, number, number]>> = {
  aspects: [97, 95, 97, 97],
  audit: [98, 91, 100, 97],
  auth: [99, 95, 98, 99],
  cli: [98, 90, 99, 98],
  di: [98, 94, 98, 98],
  drizzle: [96, 88, 100, 96],
  'eslint-plugin': [98, 91, 99, 98],
  events: [98, 91, 99, 98],
  http: [98, 93, 97, 98],
  kafka: [96, 91, 98, 96],
  kernel: [98, 94, 98, 98],
  knex: [96, 90, 98, 96],
  nats: [98, 96, 98, 98],
  openfga: [99, 94, 97, 99],
  pino: [96, 88, 100, 96],
  prisma: [97, 83, 100, 97],
  rabbitmq: [97, 97, 97, 97],
  redis: [57, 48, 60, 58],
  s3: [98, 86, 100, 98],
  scheduling: [98, 94, 98, 98],
  sentry: [99, 99, 100, 99],
  testing: [99, 96, 99, 99],
  tracing: [96, 90, 96, 96],
  typeorm: [96, 88, 97, 96],
  validation: [98, 94, 96, 100],
  winston: [96, 95, 94, 97],
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
const MEASURED_SOURCES = INTEGRATION ? ON_A_SERVER : AFFECTED;

/**
 * Git hands its hooks the repository they run for: in a worktree, a pre-push hook gets GIT_DIR. Inherited
 * by the specs, every git command they run in a throwaway repository would act on this one instead.
 */
const REPOSITORY_OF_THE_CALLER = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_PREFIX'];

for (const name of REPOSITORY_OF_THE_CALLER) {
  Reflect.deleteProperty(process.env, name);
}

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.spec.ts'],
    // Every file runs at once on a laptop, its PGlite databases and child compilers included: a
    // spec slowed by its neighbours is not a failing one, and a spec that hangs still fails.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include:
        MEASURED_SOURCES.length === 0
          ? ['packages/*/src/**']
          : MEASURED_SOURCES.map((name) => `packages/${name}/src/**`),
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
