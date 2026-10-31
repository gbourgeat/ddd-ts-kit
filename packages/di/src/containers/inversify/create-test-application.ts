import type { Container } from 'inversify';
import { createTestApplicationOn } from '../../testing/create-test-application-on';
import type { TestApplication } from '../../testing/test-application';
import type { TestApplicationOptions } from '../../testing/test-application-options';
import { inversifyContainer } from './inversify-container';

/** The modules on a deterministic, in-memory kernel, on a new InversifyJS container: see `createTestApplicationOn`. */
export function createTestApplication(options: TestApplicationOptions): TestApplication<Container> {
  return createTestApplicationOn(inversifyContainer(), options);
}
