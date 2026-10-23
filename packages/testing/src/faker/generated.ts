import type { Faker } from '@faker-js/faker';
import { lazy } from '../builders/lazy';
import type { Resolvable } from '../builders/resolvable';
import { dataGenerator } from './current-data-generator';

/**
 * A builder default, or a `with` value, generated at each build:
 * `email: generated((faker) => faker.internet.email())`.
 */
export function generated<T>(produce: (faker: Faker) => T): Resolvable<T> {
  return lazy(() => produce(dataGenerator().faker));
}
