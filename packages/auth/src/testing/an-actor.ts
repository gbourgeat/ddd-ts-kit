import { ActorBuilder } from './actor-builder.js';

const builder = new ActorBuilder();

/** `anActor().named('ada').withRole('accountant').ofTenant('acme').build()` */
export function anActor(): ActorBuilder {
  return builder;
}
