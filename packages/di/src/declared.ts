import type { DomainEvent, DomainEventDispatcher } from '@ddd-ts-kit/kernel';
import {
  declarationOf,
  type Declaration,
  type DeclaredClass,
  type DeclaredPolicy,
  type DomainEventListenerDeclaration,
  type DomainEventReaction,
  type DomainEventType,
  type EventConsumer,
  type EventContract,
  type EventListenerDeclaration,
  type HandlerDeclaration,
  type PolicyDeclaration,
  type PortDeclaration,
} from '@ddd-ts-kit/kernel/declarations';
import { receive, type ConsumerOptions } from './consumer.js';
import { WiringError } from './errors.js';
import { token, type Token } from './token.js';
import { declaredRequirement } from './use-case-access.js';
import {
  addBinding,
  addConsumption,
  addHandling,
  classRecipe,
  replaceBinding,
  type AnyMessageHandler,
  type Declarer,
  type EventConsumption,
  type EventReaction,
  type Resolve,
  type WiringDraft,
} from './wiring.js';

/**
 * Classes that declare themselves: one class, a list (lists may nest), or a namespace import of
 * a barrel, of which only the declared classes are kept.
 */
export type DeclaredSource = DeclaredClass | readonly DeclaredSource[] | Readonly<Record<string, unknown>>;

interface Inclusion {
  readonly draft: WiringDraft;
  readonly module: string;
}

/** Turns every declaration of the source into bindings of the module, in the order they come. */
export function includeDeclared(inclusion: Inclusion, source: DeclaredSource): void {
  for (const target of new Set(classesOf(source, inclusion.module))) {
    const declaration = declarationOf(target);
    if (declaration === undefined) throw undeclaredClass(target, inclusion.module);
    register({ ...inclusion, declaredBy: declarerOf(target) }, declaration);
  }
}

function classesOf(source: DeclaredSource, module: string): DeclaredClass[] {
  if (typeof source === 'function') return [source];
  if (isList(source)) return source.flatMap((part) => classesOf(part, module));
  return Object.values(source).filter(isDeclaredClass);
}

function isList(source: DeclaredSource): source is readonly DeclaredSource[] {
  return Array.isArray(source);
}

function isDeclaredClass(value: unknown): value is DeclaredClass {
  return declarationOf(value) !== undefined;
}

function undeclaredClass(target: DeclaredClass, module: string): WiringError {
  return new WiringError(
    'UNDECLARED_CLASS',
    `Class ${target.name} is listed in module "${module}" and carries no declaration decorator of @ddd-ts-kit/kernel/declarations. Decorate it, or bind it explicitly in a module.`,
  );
}

const files = new WeakMap<DeclaredClass, string>();

/** Remembers the file a class was discovered in, for the error messages and the description. */
export function rememberFile(target: DeclaredClass, file: string): void {
  files.set(target, file);
}

function declarerOf(target: DeclaredClass): Declarer {
  const file = files.get(target);
  return { className: target.name, ...(file === undefined ? {} : { file }) };
}

type ClassOf<Instance> = new (...args: never) => Instance;

interface Registration extends Inclusion {
  readonly declaredBy: Declarer;
}

function register(registration: Registration, declaration: Declaration): void {
  switch (declaration.role) {
    case 'message':
      return;
    case 'command-handler':
    case 'query-handler':
      registerHandler(registration, declaration);
      return;
    case 'event-listener':
      registerEventListener(registration, declaration);
      return;
    case 'domain-event-listener':
      registerDomainEventListener(registration, declaration);
      return;
    case 'policy':
      registerPolicy(registration, declaration);
      return;
    default:
      registerPort(registration, declaration);
  }
}

function registerHandler(registration: Registration, declaration: HandlerDeclaration): void {
  const { draft, module, declaredBy } = registration;
  const { message, implementation, dependencies } = declaration;
  const handler = token<AnyMessageHandler>(implementation.name);
  addBinding(draft, {
    ...classRecipe(implementation, dependencies),
    token: handler,
    module,
    declaredBy,
    lifetime: 'singleton',
    kind: 'use-case',
    aspects: [],
  });
  addHandling(draft, {
    kind: declaration.role === 'command-handler' ? 'command' : 'query',
    message,
    handler,
    module,
    requirement: declaredRequirement(message),
    declaredBy,
  });
}

function registerEventListener(registration: Registration, declaration: EventListenerDeclaration): void {
  const { draft, module, declaredBy } = registration;
  const { consumer, actorOf, dependencies } = declaration;
  const options: ConsumerOptions = { consumer, ...(actorOf === undefined ? {} : { actorOf }) };
  declaration.pair(<Payload>(contract: EventContract<Payload>, implementation: ClassOf<EventConsumer<Payload>>) => {
    const handler = token<EventConsumer<Payload>>(implementation.name);
    addBinding(draft, {
      ...classRecipe(implementation, dependencies),
      token: handler,
      module,
      declaredBy,
      lifetime: 'singleton',
      kind: 'consumer',
      aspects: [],
    });
    addConsumption(draft, consumptionOf({ contract, options, handler, module, declaredBy }));
  });
}

interface Subscribing<Payload> {
  readonly contract: EventContract<Payload>;
  readonly options: ConsumerOptions;
  readonly handler: Token<EventConsumer<Payload>>;
  readonly module: string;
  readonly declaredBy?: Declarer;
}

/** The subscription of one consumer, whether a module wrote it or a class declared it. */
export function consumptionOf<Payload>(subscribing: Subscribing<Payload>): EventConsumption {
  const { contract, options, handler, module, declaredBy } = subscribing;
  return {
    type: contract.type,
    version: contract.version,
    consumer: options.consumer,
    handler,
    module,
    ...(declaredBy === undefined ? {} : { declaredBy }),
    subscribe: (resolve, runtime) =>
      receive({ contract, options, runtime, handle: (event) => resolve(handler).handle(event) }),
  };
}

function registerDomainEventListener(registration: Registration, declaration: DomainEventListenerDeclaration): void {
  const { draft, module, declaredBy } = registration;
  const { name, dependencies } = declaration;
  declaration.pair(<E extends DomainEvent>(event: DomainEventType<E>, implementation: ClassOf<DomainEventReaction<E>>) => {
    const handler = token<DomainEventReaction<E>>(implementation.name);
    addBinding(draft, {
      ...classRecipe(implementation, dependencies),
      token: handler,
      module,
      declaredBy,
      lifetime: 'singleton',
      kind: 'consumer',
      aspects: [],
    });
    draft.reactions.push({ name, event: event.name, handler, module, declaredBy, attach: attaching(name, event, handler) });
  });
}

/*
 * An event dispatched under the name and built from another class is left alone, as a
 * hand-written subscription would leave it: the listener is typed by the class it declared.
 */
function attaching<E extends DomainEvent>(
  name: string,
  event: DomainEventType<E>,
  handler: Token<DomainEventReaction<E>>,
): EventReaction['attach'] {
  return (resolve: Resolve, dispatcher: DomainEventDispatcher) => {
    dispatcher.on(name, async (occurred) => {
      if (occurred instanceof event) await resolve(handler).handle(occurred);
    });
  };
}

function registerPolicy(registration: Registration, declaration: PolicyDeclaration): void {
  const { draft, module, declaredBy } = registration;
  const { name, permission, implementation, dependencies } = declaration;
  const policy = token<DeclaredPolicy>(implementation.name);
  addBinding(draft, {
    ...classRecipe(implementation, dependencies),
    token: policy,
    module,
    declaredBy,
    lifetime: 'singleton',
    aspects: [],
  });
  draft.policies.push({ name, permission, policy, module, declaredBy });
}

function registerPort(registration: Registration, declaration: PortDeclaration): void {
  const { draft, module, declaredBy } = registration;
  const { implementation, dependencies, lifetime, kind, aspects } = declaration;
  const binding = {
    ...classRecipe(implementation, dependencies),
    token: declaration.token,
    module,
    declaredBy,
    lifetime,
    kind,
    aspects,
  };
  if (declaration.replaces) replaceBinding(draft, binding);
  else addBinding(draft, binding);
}
