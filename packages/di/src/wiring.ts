import type {
  DependencyKind,
  DomainEventDispatcher,
  IntegrationEventCallback,
  JobOptions,
  JobSchedule,
  ScheduledJob,
  Message,
  MessageInfo,
  MessageType,
} from '@ddd-ts-kit/kernel';
import type { BindingAspect, DeclaredPolicy, MessageHandler, PermissionRef } from '@ddd-ts-kit/kernel/declarations';
import type { ConsumerRuntime } from './consumer.js';
import { WiringError } from './errors.js';
import { describeToken, type Token } from './token.js';
import type { Requirement } from './use-case-access.js';

export type Lifetime = 'singleton' | 'transient';

export type Resolve = <T>(token: Token<T>) => T;

export type BindingSource = 'class' | 'factory' | 'value';

/** The class whose decorator made a binding, and the file discovery loaded it from. */
export interface Declarer {
  readonly className: string;
  readonly file?: string;
}

export interface Binding {
  readonly token: Token<unknown>;
  readonly module: string;
  readonly source: BindingSource;
  readonly implementation?: string;
  /** Known only for a class: factories resolve what they want at run time. */
  readonly dependencies: readonly Token<unknown>[];
  readonly create: (resolve: Resolve) => unknown;
  /** Absent for a binding written in a module. */
  readonly declaredBy?: Declarer;
  lifetime: Lifetime;
  kind?: DependencyKind;
  /** Outermost first. */
  aspects: readonly BindingAspect[];
}

export type AnyMessageHandler = MessageHandler<never>;

export interface MessageHandling {
  readonly kind: MessageInfo['kind'];
  readonly message: MessageType<Message>;
  readonly handler: Token<AnyMessageHandler>;
  readonly module: string;
  /** Empty when neither the module nor the message declared an access. */
  readonly requirement: Requirement;
  readonly declaredBy?: Declarer;
}

export interface EventConsumption {
  readonly type: string;
  readonly version: number;
  readonly consumer: string;
  readonly handler: Token<unknown>;
  readonly module: string;
  readonly declaredBy?: Declarer;
  readonly subscribe: (resolve: Resolve, runtime: ConsumerRuntime) => IntegrationEventCallback;
}

/** A handler of a domain event of its own context, attached to the dispatcher of the application. */
export interface DomainEventHandling {
  /** The name the events carry. */
  readonly name: string;
  /** Name of the class the handler is typed by: an event of another class is not handed to it. */
  readonly event: string;
  readonly handler: Token<unknown>;
  readonly module: string;
  readonly declaredBy?: Declarer;
  readonly attach: (resolve: Resolve, dispatcher: DomainEventDispatcher) => void;
}

/** A policy class a context declared, for the authorization module to evaluate. */
export interface PolicyBinding {
  readonly name: string;
  readonly permission: PermissionRef;
  readonly policy: Token<DeclaredPolicy>;
  readonly module: string;
  readonly declaredBy?: Declarer;
}

/** A job a context declared, for the application to register on the job scheduler. */
export interface JobRegistration {
  readonly name: string;
  readonly schedule: JobSchedule;
  /** As declared: the settings of the application and the defaults come on top. */
  readonly options: JobOptions;
  readonly job: Token<ScheduledJob>;
  readonly module: string;
  readonly declaredBy?: Declarer;
}

export interface Wiring {
  readonly modules: readonly string[];
  readonly bindings: ReadonlyMap<Token<unknown>, Binding>;
  readonly handlings: readonly MessageHandling[];
  readonly consumptions: readonly EventConsumption[];
  readonly domainEventHandlers: readonly DomainEventHandling[];
  readonly policies: readonly PolicyBinding[];
  readonly jobs: readonly JobRegistration[];
}

export interface WiringDraft {
  readonly bindings: Map<Token<unknown>, Binding>;
  readonly handlings: MessageHandling[];
  readonly consumptions: EventConsumption[];
  readonly domainEventHandlers: DomainEventHandling[];
  readonly policies: PolicyBinding[];
  readonly jobs: JobRegistration[];
}

export function emptyDraft(): WiringDraft {
  return { bindings: new Map(), handlings: [], consumptions: [], domainEventHandlers: [], policies: [], jobs: [] };
}

export function addBinding(draft: WiringDraft, binding: Binding): void {
  const existing = draft.bindings.get(binding.token);
  if (existing !== undefined) {
    throw new WiringError(
      'DUPLICATE_BINDING',
      `Token "${describeToken(binding.token)}" is bound twice: by ${whereOf(existing)} and by ${whereOf(binding)}.`,
    );
  }
  draft.bindings.set(binding.token, binding);
}

export function replaceBinding(draft: WiringDraft, binding: Binding): void {
  if (!draft.bindings.has(binding.token)) {
    throw new WiringError(
      'NOTHING_TO_REBIND',
      `${capitalized(whereOf(binding))} rebinds "${describeToken(binding.token)}", which no earlier module binds. List the module that binds it first, or use bind.`,
    );
  }
  draft.bindings.set(binding.token, binding);
}

export function addHandling(draft: WiringDraft, handling: MessageHandling): void {
  const existing = draft.handlings.find(
    (other) => other.kind === handling.kind && other.message === handling.message,
  );
  if (existing !== undefined) {
    throw new WiringError(
      'DUPLICATE_HANDLER',
      `The ${handling.kind} "${handling.message.name}" has two handlers: "${describeToken(existing.handler)}" in ${whereOf(existing)} and "${describeToken(handling.handler)}" in ${whereOf(handling)}.`,
    );
  }
  draft.handlings.push(handling);
}

export function addConsumption(draft: WiringDraft, consumption: EventConsumption): void {
  const { consumer, type, version } = consumption;
  const existing = draft.consumptions.find(
    (other) => other.consumer === consumer && other.type === type && other.version === version,
  );
  if (existing !== undefined) {
    throw new WiringError(
      'DUPLICATE_CONSUMER',
      `Consumer "${consumer}" is declared twice for ${type} v${version}: in ${whereOf(existing)} and in ${whereOf(consumption)}. Sharing a name would make one of them skip every event.`,
    );
  }
  draft.consumptions.push(consumption);
}

export function addJob(draft: WiringDraft, registration: JobRegistration): void {
  const existing = draft.jobs.find((other) => other.name === registration.name);
  if (existing !== undefined) {
    throw new WiringError(
      'DUPLICATE_JOB',
      `Job "${registration.name}" is declared twice: in ${whereOf(existing)} and in ${whereOf(registration)}. The name of a job is its lock, its actor and its label: it is unique in an application.`,
    );
  }
  draft.jobs.push(registration);
}

interface Located {
  readonly module: string;
  readonly declaredBy?: Declarer;
}

/** `module "billing"`, followed by the class and the file when a decorator made the declaration. */
export function whereOf({ module, declaredBy }: Located): string {
  if (declaredBy === undefined) return `module "${module}"`;
  const file = declaredBy.file === undefined ? '' : ` in ${declaredBy.file}`;
  return `module "${module}" (declared by class ${declaredBy.className}${file})`;
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type Recipe = Pick<Binding, 'source' | 'implementation' | 'dependencies' | 'create'>;

export function classRecipe(
  implementation: new (...args: never) => unknown,
  dependencies: readonly Token<unknown>[] = [],
): Recipe {
  return {
    source: 'class',
    implementation: implementation.name,
    dependencies,
    create: (resolve): unknown => Reflect.construct(implementation, dependencies.map(resolve)),
  };
}

export function factoryRecipe(factory: (resolve: Resolve) => unknown): Recipe {
  return { source: 'factory', dependencies: [], create: factory };
}
