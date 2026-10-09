import { Faker, base, en, type LocaleDefinition } from '@faker-js/faker';
import { lazy, type Resolvable } from './builder.js';

export interface DataGeneratorOptions {
  /** Default: the `TEST_SEED` environment variable, else a random seed. */
  readonly seed?: number;
  /** Locales by decreasing priority. Default: English. */
  readonly locales?: readonly LocaleDefinition[];
  /**
   * The instant relative dates (`faker.date.recent()`) are computed from. Fixed by default,
   * at 2026-01-01T00:00:00.000Z, so that a seed replays the dates too.
   */
  readonly referenceDate?: Date;
}

export interface DataGenerator {
  /** Always known, also when it was drawn at random: print it when a test fails. */
  readonly seed: number;
  readonly faker: Faker;
  /** Starts the sequence again from the seed. */
  restart(): void;
}

/**
 * A builder default, or a `with` value, generated at each build:
 * `email: generated((faker) => faker.internet.email())`.
 */
export function generated<T>(produce: (faker: Faker) => T): Resolvable<T> {
  return lazy(() => produce(dataGenerator().faker));
}

let current: DataGenerator | undefined;

/**
 * The generator every `generated` value is drawn from, so that one seed replays a whole test
 * file. Created on first use, from `TEST_SEED` or a random seed.
 */
export function dataGenerator(): DataGenerator {
  current ??= createDataGenerator();
  return current;
}

/** Makes `generated` draw from this generator from now on. */
export function useDataGenerator(generator: DataGenerator): DataGenerator {
  current = generator;
  return generator;
}

export function createDataGenerator(options: DataGeneratorOptions = {}): DataGenerator {
  const seed = options.seed ?? seedFromEnvironment() ?? randomSeed();
  const faker = new Faker({ locale: [...(options.locales ?? [en, base])] });
  faker.setDefaultRefDate(options.referenceDate ?? DEFAULT_REFERENCE_DATE);
  faker.seed(seed);
  return { seed, faker, restart: () => void faker.seed(seed) };
}

const DEFAULT_REFERENCE_DATE = new Date('2026-01-01T00:00:00.000Z');

function seedFromEnvironment(): number | undefined {
  const raw = process.env.TEST_SEED;
  if (raw === undefined || raw === '') return undefined;
  const seed = Number(raw);
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError(`TEST_SEED must be an integer, got "${raw}"`);
  }
  return seed;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** What `reportSeedOnFailure` needs from the runner; `beforeEach` and `onTestFailed` of vitest fit. */
export interface FailureReportingRunner {
  beforeEach(setup: () => void): unknown;
  onTestFailed(report: () => void): unknown;
}

/**
 * Prints the seed under every failed test of the file, with the way to replay it:
 * `reportSeedOnFailure({ beforeEach, onTestFailed })`.
 */
export function reportSeedOnFailure(
  runner: FailureReportingRunner,
  log: (message: string) => void = console.error,
): void {
  runner.beforeEach(() => {
    runner.onTestFailed(() => log(replayHint(dataGenerator().seed)));
  });
}

export function replayHint(seed: number): string {
  return `Generated data seed: ${seed}. Replay this file with TEST_SEED=${seed}.`;
}
