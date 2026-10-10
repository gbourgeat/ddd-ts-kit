import type { Faker } from '@faker-js/faker';

export interface DataGenerator {
  /** Always known, also when it was drawn at random: print it when a test fails. */
  readonly seed: number;
  readonly faker: Faker;
  /** Starts the sequence again from the seed. */
  restart(): void;
}
