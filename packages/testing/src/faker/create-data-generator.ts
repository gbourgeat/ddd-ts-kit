import { Faker, base, en, type LocaleDefinition } from '@faker-js/faker';
import type { DataGenerator } from './data-generator';

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

  if (raw === undefined || raw === '') {
    return undefined;
  }

  const seed = Number(raw);

  if (!Number.isSafeInteger(seed)) {
    throw new TypeError(`TEST_SEED must be an integer, got "${raw}"`);
  }

  return seed;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
