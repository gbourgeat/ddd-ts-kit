import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { NestControllerClass } from './nest-controller-class';

/** Where the decorators of the methods of a controller wrote: its prototype. */
export function prototypeOf(controller: NestControllerClass): object {
  const prototype: unknown = controller.prototype;

  if (typeof prototype !== 'object' || prototype === null) {
    throw new DeclarationError(`${controller.name} has no prototype: it is no class.`);
  }

  return prototype;
}
