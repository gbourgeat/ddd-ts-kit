import type { AwilixContainer } from 'awilix';
import type { ApplicationOptions } from '../../application/application-options';
import type { Application } from '../../application/application';
import { createApplicationOn } from '../../application/create-application-on';
import { awilixContainer } from './awilix-container';

/** The application of the kit on a new Awilix container: see `createApplicationOn`. */
export function createApplication(options: ApplicationOptions): Application<AwilixContainer> {
  return createApplicationOn(awilixContainer(), options);
}
