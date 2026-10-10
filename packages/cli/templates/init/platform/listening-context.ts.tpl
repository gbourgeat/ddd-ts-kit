import { EXECUTION_SCOPE, PROCESSED_EVENTS, UNIT_OF_WORK, UnreadableEventError, defineContextModule, token, type ContextModule, type ModuleBuilder, type Resolve } from '@ddd-ts-kit/di';
import { idempotent, inEventScope, type IntegrationEventCallback } from '@ddd-ts-kit/kernel';
import {
  declarationOf,
  type Declaration,
  type DeclaredClass,
  type EventContract,
  type IntegrationEventHandlerDeclaration,
  type IntegrationEventHandler,
} from '@ddd-ts-kit/kernel/declarations';
import { CONTEXT_EVENTS } from './platform.module.js';

/** One integration event handler of a context: its binding, and the delivery its subscriber is given. */
interface Subscribed {
  readonly type: string;
  bind(builder: ModuleBuilder): void;
  delivery(resolve: Resolve): IntegrationEventCallback;
}

/**
 * The module of a declared context behind the broker: every class is bound by its declaration,
 * and the integration event handlers listen through the subscriber of the context, under its own
 * name, so that an extracted context keeps its queues. The idempotency mark and the work of a
 * handler commit in one unit of work, inside the execution context of the event.
 */
export function listeningContext(name: string, declared: Readonly<Record<string, unknown>>): ContextModule {
  const classes = Object.values(declared).filter(isDeclared);
  const subscribed = classes.flatMap((target) => subscribedBy(declarationOf(target)));
  return defineContextModule({
    name,
    register(builder) {
      builder.include(classes.filter((target) => declarationOf(target)?.role !== 'integration-event-handler'));
      for (const handler of subscribed) handler.bind(builder);
    },
    onStart({ resolve }) {
      const subscriber = resolve(CONTEXT_EVENTS)(name);
      for (const handler of subscribed) subscriber.subscribe(handler.type, handler.delivery(resolve));
    },
  });
}

function isDeclared(value: unknown): value is DeclaredClass {
  return declarationOf(value) !== undefined;
}

function subscribedBy(declaration: Declaration | undefined): Subscribed[] {
  if (declaration?.role !== 'integration-event-handler') return [];
  return [
    declaration.pair(<Payload>(contract: EventContract<Payload>, implementation: new (...args: never) => IntegrationEventHandler<Payload>) => {
      const handler = token<IntegrationEventHandler<Payload>>(implementation.name);
      return {
        type: contract.type,
        bind: (builder) => void builder.bind(handler).toFactory((resolve) => built(implementation, declaration.dependencies.map((dependency) => resolve(dependency)))).as('consumer'),
        delivery: (resolve) => consuming(declaration, resolve, reading(contract, (event) => resolve(handler).handle(event))),
      };
    }),
  ];
}

/** The dependency list of a declaration was checked against the constructor where the class is written: here it is only followed. */
function built<Payload>(implementation: new (...args: never) => IntegrationEventHandler<Payload>, dependencies: readonly unknown[]): IntegrationEventHandler<Payload> {
  const instance: unknown = Reflect.construct(implementation, dependencies);
  if (isHandler<Payload>(instance)) return instance;
  throw new TypeError(`${implementation.name} is declared as an integration event handler and has no handle method.`);
}

function isHandler<Payload>(instance: unknown): instance is IntegrationEventHandler<Payload> {
  return typeof instance === 'object' && instance !== null && 'handle' in instance && typeof instance.handle === 'function';
}

const MEANT_FOR_ANOTHER = ['type-mismatch', 'version-mismatch'];

/** Another version of the type has its own handler; an event the contract cannot read is thrown back, for the broker to retry then dead-letter. */
function reading<Payload>(contract: EventContract<Payload>, handle: IntegrationEventHandler<Payload>['handle']): IntegrationEventCallback {
  return async (event) => {
    const parsed = contract.parse(event);
    if (parsed.ok) await handle(parsed.value);
    else if (!MEANT_FOR_ANOTHER.includes(parsed.error.reason)) throw new UnreadableEventError(event.type, event.version, parsed.error.reason);
  };
}

function consuming({ consumer, actorOf }: IntegrationEventHandlerDeclaration, resolve: Resolve, delivery: IntegrationEventCallback): IntegrationEventCallback {
  const once = idempotent(consumer, resolve(PROCESSED_EVENTS), delivery);
  const options = { consumer, ...(actorOf === undefined ? {} : { actorOf }) };
  return inEventScope(resolve(EXECUTION_SCOPE), options, (event) => resolve(UNIT_OF_WORK).run(() => once(event)));
}
