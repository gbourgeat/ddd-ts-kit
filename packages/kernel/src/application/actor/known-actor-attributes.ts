import type { ActorAttribute } from './actor-attribute';
import type { ActorExtensions } from './actor-extensions';

/** An extension whose type is not an `ActorAttribute` reads as `never`: it could not be serialized. */
export type KnownActorAttributes = {
  readonly [Key in keyof ActorExtensions]?: ActorExtensions[Key] extends ActorAttribute ? ActorExtensions[Key] : never;
};
