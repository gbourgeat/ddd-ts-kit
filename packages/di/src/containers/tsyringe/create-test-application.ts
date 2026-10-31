import type { DependencyContainer } from 'tsyringe';
import { createTestApplicationOn } from '../../testing/create-test-application-on';
import type { TestApplication } from '../../testing/test-application';
import type { TestApplicationOptions } from '../../testing/test-application-options';
import { tsyringeContainer } from './tsyringe-container';

/** The modules on a deterministic, in-memory kernel, on a new tsyringe container: see `createTestApplicationOn`. */
export function createTestApplication(options: TestApplicationOptions): TestApplication<DependencyContainer> {
  return createTestApplicationOn(tsyringeContainer(), options);
}
