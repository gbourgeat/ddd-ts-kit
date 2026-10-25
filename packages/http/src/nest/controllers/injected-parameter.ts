import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { type Injected, nestRoutesRegistry } from './nest-routes-registry';

/** A parameter decorator of the kit: what it hands the parameter at that index of the method. */
export function injectedParameter(
  what: Injected,
): (target: object, method: string | symbol | undefined, index: number) => void {
  return (target, method, index) => {
    if (typeof method !== 'string') {
      throw new DeclarationError('A parameter decorator of the kit goes on a parameter of a method of a controller.');
    }

    const { injected } = nestRoutesRegistry();
    const methods = injected.get(target) ?? new Map<string, Map<number, Injected>>();
    const parameters = methods.get(method) ?? new Map<number, Injected>();

    parameters.set(index, what);
    methods.set(method, parameters);
    injected.set(target, methods);
  };
}
