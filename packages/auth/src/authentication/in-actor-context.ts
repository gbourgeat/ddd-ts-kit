import type { ActorContext } from '@ddd-ts-kit/kernel';
import { actorOf } from './actor-of.js';

interface WithPrincipal {
  readonly context: { readonly principal?: unknown };
}

/**
 * Wraps a route handler so that everything it calls sees the actor through `ActorContext`:
 * repositories stamping audit columns, tenant scoping. Use cases still get it in the message.
 * Not needed when the adapter of @ddd-ts-kit/http is given an `executionScope` and the actor
 * context is a `ScopedActorContext` over it, as `kernelModule()` binds them.
 */
export function inActorContext<Input extends WithPrincipal, Output>(
  actorContext: ActorContext,
  handle: (input: Input) => Output,
): (input: Input) => Output {
  return (input) => actorContext.run(actorOf(input.context.principal), () => handle(input));
}
