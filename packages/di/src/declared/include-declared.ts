import type { DependencyKind, DomainEvent } from '@ddd-ts-kit/kernel';
import {
  declarationOf,
  type Declaration,
  type DeclaredClass,
  type Dependencies,
  type DomainEventHandler,
  type DomainEventHandlerDeclaration,
  type DomainEventType,
  type EventContract,
  type HandlerDeclaration,
  type IntegrationEventHandler,
  type IntegrationEventHandlerDeclaration,
  type JobDeclaration,
  type PolicyDeclaration,
  type PortDeclaration,
  type ProjectionDeclaration,
  type Token,
} from '@ddd-ts-kit/kernel/declarations';
import { declaredRequirement } from '../authorization/declared-requirement.js';
import type { ConsumerOptions } from '../consumer/consumer-options.js';
import { WiringError } from '../errors/wiring-error.js';
import { assertPort } from '../wiring/assert-port.js';
import type { Binding } from '../wiring/binding.js';
import type { Declarer } from '../wiring/declarer.js';
import type { DomainEventHandling } from '../wiring/domain-event-handling.js';
import { classRecipe } from '../wiring/recipe.js';
import type { WiringDraft } from '../wiring/wiring-draft.js';
import { consumptionOf } from './consumption-of.js';
import type { DeclaredSource } from './declared-source.js';
import { declarerOf } from './discovered-files.js';
import { projectionOf } from './projection-of.js';

interface Inclusion {
  readonly draft: WiringDraft;
  readonly module: string;
}

/** Turns every declaration of the source into bindings of the module, in the order they come. */
export function includeDeclared(inclusion: Inclusion, source: DeclaredSource): void {
  for (const target of new Set(classesOf(source))) {
    const declaration = declarationOf(target);

    if (declaration === undefined) throw undeclaredClass(target, inclusion.module);

    register({ ...inclusion, declaredBy: declarerOf(target) }, declaration);
  }
}

function classesOf(source: DeclaredSource): DeclaredClass[] {
  if (typeof source === 'function') return [source];

  if (isList(source)) return source.flatMap((part) => classesOf(part));

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
    case 'integration-event-handler':
      registerIntegrationEventHandler(registration, declaration);

      return;
    case 'domain-event-handler':
      registerDomainEventHandler(registration, declaration);

      return;
    case 'policy':
      registerPolicy(registration, declaration);

      return;
    case 'job':
      registerJob(registration, declaration);

      return;
    case 'projection':
      registerProjection(registration, declaration);

      return;
    default:
      registerPort(registration, declaration);
  }
}

function registerHandler(registration: Registration, declaration: HandlerDeclaration): void {
  const { draft, module, declaredBy } = registration;
  const { message, implementation, dependencies } = declaration;

  draft.addHandling({
    kind: declaration.role === 'command-handler' ? 'command' : 'query',
    message,
    handler: implementation,
    module,
    requirement: declaredRequirement(message),
    declaredBy,
  });

  draft.addBinding(underItself(registration, { implementation, dependencies, kind: 'use-case' }));
}

type ClassOf<Instance> = new (...args: never) => Instance;

interface SelfBound {
  readonly implementation: ClassOf<unknown>;
  readonly dependencies: Dependencies;
  readonly kind?: DependencyKind;
}

/** A declared class is bound under itself: the class is the token of what it builds. */
function underItself({ module, declaredBy }: Registration, { implementation, dependencies, kind }: SelfBound): Binding {
  return {
    ...classRecipe(implementation, dependencies),
    token: implementation,
    module,
    declaredBy,
    lifetime: 'singleton',
    aspects: [],
    ...(kind === undefined ? {} : { kind }),
  };
}

function registerIntegrationEventHandler(registration: Registration, declaration: IntegrationEventHandlerDeclaration): void {
  const { draft, module, declaredBy } = registration;
  const { consumer, actorOf, dependencies } = declaration;
  const options: ConsumerOptions = { consumer, ...(actorOf === undefined ? {} : { actorOf }) };

  declaration.pair(<Payload>(contract: EventContract<Payload>, implementation: ClassOf<IntegrationEventHandler<Payload>>) => {
    draft.addConsumption(consumptionOf({ contract, options, handler: implementation, module, declaredBy }));
    draft.addBinding(underItself(registration, { implementation, dependencies, kind: 'consumer' }));
  });
}

function registerDomainEventHandler(registration: Registration, declaration: DomainEventHandlerDeclaration): void {
  const { draft, module, declaredBy } = registration;
  const { name, phase, dependencies } = declaration;

  declaration.pair(<E extends DomainEvent>(event: DomainEventType<E>, implementation: ClassOf<DomainEventHandler<E>>) => {
    draft.addBinding(underItself(registration, { implementation, dependencies, kind: 'domain-event-handler' }));

    draft.addDomainEventHandler({
      name,
      phase,
      event: event.name,
      handler: implementation,
      module,
      declaredBy,
      attach: attaching({ name, phase }, event, implementation),
    });
  });
}

/*
 * An event dispatched under the name and built from another class is left alone, as a
 * hand-written subscription would leave it: the handler is typed by the class it declared.
 */
function attaching<E extends DomainEvent>(
  { name, phase }: Pick<DomainEventHandlerDeclaration, 'name' | 'phase'>,
  event: DomainEventType<E>,
  handler: Token<DomainEventHandler<E>>,
): DomainEventHandling['attach'] {
  return (resolve, dispatcher) => {
    const handle = async (occurred: DomainEvent): Promise<void> => {
      if (occurred instanceof event) await resolve(handler).handle(occurred);
    };

    dispatcher.on(name, handle, { phase });
  };
}

function registerPolicy(registration: Registration, declaration: PolicyDeclaration): void {
  const { draft, module, declaredBy } = registration;
  const { name, permission, implementation, dependencies } = declaration;

  draft.addBinding(underItself(registration, { implementation, dependencies }));
  draft.addPolicy({ name, permission, policy: implementation, module, declaredBy });
}

function registerJob(registration: Registration, declaration: JobDeclaration): void {
  const { draft, module, declaredBy } = registration;
  const { name, schedule, options, implementation, dependencies } = declaration;

  draft.addJob({ name, schedule, options, job: implementation, module, declaredBy });
  draft.addBinding(underItself(registration, { implementation, dependencies, kind: 'job' }));
}

function registerProjection(registration: Registration, declaration: ProjectionDeclaration): void {
  const { draft, module, declaredBy } = registration;
  const { implementation, dependencies } = declaration;
  const wired = projectionOf({ declaration, module, declaredBy });

  draft.addProjection(wired.registration);
  draft.addBinding(underItself(registration, { implementation, dependencies, kind: 'consumer' }));

  for (const consumption of wired.consumptions) draft.addConsumption(consumption);

  for (const handling of wired.domainEventHandlers) draft.addDomainEventHandler(handling);
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

  assertPort(declaration.token, implementation, module);

  if (declaration.replaces) draft.replaceBinding(binding);
  else draft.addBinding(binding);
}
