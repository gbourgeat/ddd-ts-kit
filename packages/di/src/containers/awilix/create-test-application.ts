import type { AwilixContainer } from 'awilix';
import { createTestApplicationOn } from '../../testing/create-test-application-on';
import type { TestApplication } from '../../testing/test-application';
import type { TestApplicationOptions } from '../../testing/test-application-options';
import { awilixContainer } from './awilix-container';

/** The modules on a deterministic, in-memory kernel, on a new Awilix container: see `createTestApplicationOn`. */
export function createTestApplication(options: TestApplicationOptions): TestApplication<AwilixContainer> {
  return createTestApplicationOn(awilixContainer(), options);
}
