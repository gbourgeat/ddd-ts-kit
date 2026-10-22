import type { AspectInfo } from '../aspect/aspect-info';
import type { JoinPoint } from '../aspect/join-point';

/** What every join point of an instance says of it. */
export function siteOf(instance: object, info: AspectInfo): Omit<JoinPoint, 'method' | 'arity'> {
  return {
    instance,
    className: info.className ?? constructorNameOf(instance),
    ...(info.kind === undefined ? {} : { kind: info.kind }),
    ...(info.context === undefined ? {} : { context: info.context }),
    ...(info.token === undefined ? {} : { token: info.token }),
  };
}

function constructorNameOf(instance: object): string {
  const constructor: unknown = Reflect.get(instance, 'constructor');

  return typeof constructor === 'function' && constructor.name !== '' ? constructor.name : 'Object';
}
