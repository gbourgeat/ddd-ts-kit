import { injectedParameter } from './injected-parameter';

/**
 * The caller of the route, as the authentication of the platform resolved it, for the command or
 * the query the method sends: never an actor built by the controller.
 */
export function CurrentActor(): (target: object, method: string | symbol | undefined, index: number) => void {
  return injectedParameter('actor');
}
