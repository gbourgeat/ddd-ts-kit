import type { DependencyContainer } from 'tsyringe';
import type { ApplicationOptions } from '../../application/application-options';
import type { Application } from '../../application/application';
import { createApplicationOn } from '../../application/create-application-on';
import { tsyringeContainer } from './tsyringe-container';

/** The application of the kit on a new tsyringe container: see `createApplicationOn`. */
export function createApplication(options: ApplicationOptions): Application<DependencyContainer> {
  return createApplicationOn(tsyringeContainer(), options);
}
