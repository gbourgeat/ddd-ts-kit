import type { Faker } from '@faker-js/faker';
import { lazy } from '../builders/lazy.js';
import type { Resolvable } from '../builders/resolvable.js';
import { dataGenerator } from './current-data-generator.js';

/**
 * A builder default, or a `with` value, generated at each build:
 * `email: generated((faker) => faker.internet.email())`.
 */
export function generated<T>(produce: (faker: Faker) => T): Resolvable<T> {
  return lazy(() => produce(dataGenerator().faker));
}
