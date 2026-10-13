import { defineConfig } from 'vitest/config';

/**
 * The floor of each package, as [statements, branches, functions, lines]: what the unit run measured
 * on 2026-10-10, rounded down, so that the coverage of a package cannot fall without the gate
 * saying so. A floor is raised when the package gains tests, never lowered to make a change pass.
 * The four broker packages are low on purpose of the measure, not of the code: most of their specs
 * need a server and run in the integration job, which this run skips.
 */
const FLOORS: Readonly<Record<string, readonly [number, number, number, number]>> = {
  aspects: [97, 95, 97, 97],
  audit: [98, 91, 100, 97],
  auth: [99, 95, 98, 99],
  cli: [97, 89, 98, 97],
  di: [98, 94, 98, 98],
  drizzle: [96, 88, 100, 96],
  'eslint-plugin': [98, 91, 99, 98],
  events: [98, 91, 99, 98],
  http: [98, 93, 97, 98],
  kafka: [24, 24, 25, 24],
  kernel: [85, 78, 87, 85],
  knex: [90, 77, 98, 90],
  nats: [32, 36, 39, 32],
  openfga: [99, 94, 97, 99],
  pino: [96, 88, 100, 96],
  prisma: [95, 80, 100, 95],
  rabbitmq: [30, 29, 31, 30],
  redis: [57, 48, 60, 58],
  scheduling: [98, 94, 98, 98],
  sentry: [93, 84, 100, 93],
  testing: [92, 87, 93, 92],
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
    coverage: {
      provider: 'v8',
      include: AFFECTED.length === 0 ? ['packages/*/src/**'] : AFFECTED.map((name) => `packages/${name}/src/**`),
      reporter: ['text', 'cobertura', 'lcov'],
      thresholds: Object.fromEntries(
        MEASURED.map(([name, [statements, branches, functions, lines]]) => [
          `packages/${name}/src/**`,
          { statements, branches, functions, lines },
        ]),
      ),
    },
  },
});
