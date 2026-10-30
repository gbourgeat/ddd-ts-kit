import type { ErasedController } from '../../controller/erased-controller';
import type { NestMethod } from './nest-method';
import type { Injected } from './nest-routes-registry';

type Request = Parameters<ErasedController['handle']>[0];

/** The arguments of the method, in the order of its parameters, from the validated request. */
export function argumentsOf({ read, injected }: NestMethod, request: Request): unknown[] {
  const arity = Math.max(-1, ...read.parameters.map(({ index }) => index), ...injected.keys()) + 1;
  const args: unknown[] = Array.from({ length: arity }, () => undefined);

  for (const { index, source, key } of read.parameters) {
    const part: unknown = request[source];

    args[index] = key === undefined ? part : fieldOf(part, source === 'headers' ? key.toLowerCase() : key);
  }

  const handed: Readonly<Record<Injected, unknown>> = {
    actor: request.actor,
    context: request.context,
    upload: request.upload,
  };

  for (const [index, what] of injected) {
    args[index] = handed[what];
  }

  return args;
}

function fieldOf(part: unknown, key: string): unknown {
  if (typeof part !== 'object' || part === null) {
    return undefined;
  }

  const value: unknown = Reflect.get(part, key);

  return value;
}
