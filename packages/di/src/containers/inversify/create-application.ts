import type { Container } from 'inversify';
import type { ApplicationOptions } from '../../application/application-options';
import type { Application } from '../../application/application';
import { createApplicationOn } from '../../application/create-application-on';
import { inversifyContainer } from './inversify-container';

/** The application of the kit on a new InversifyJS container: see `createApplicationOn`. */
export function createApplication(options: ApplicationOptions): Application<Container> {
  return createApplicationOn(inversifyContainer(), options);
}
