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

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      reporter: ['text', 'cobertura', 'lcov'],
      thresholds: Object.fromEntries(
        Object.entries(FLOORS).map(([name, [statements, branches, functions, lines]]) => [
          `packages/${name}/src/**`,
          { statements, branches, functions, lines },
        ]),
      ),
    },
  },
});
