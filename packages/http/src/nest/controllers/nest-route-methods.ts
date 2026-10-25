import { METHOD_METADATA } from '@nestjs/common/constants';
import type { NestControllerClass } from './nest-controller-class';
import { prototypeOf } from './prototype-of';
import { reflectedMetadata } from './reflected-metadata';

/** The methods of a controller that carry a route decorator of Nest (`@Get`, `@Post`...), in the order of the class. */
export function nestRouteMethods(controller: NestControllerClass): string[] {
  const prototype = prototypeOf(controller);

  return Object.getOwnPropertyNames(prototype).filter((name) => {
    const member: unknown = name === 'constructor' ? undefined : Reflect.get(prototype, name);

    return typeof member === 'function' && reflectedMetadata(METHOD_METADATA, member) !== undefined;
  });
}
