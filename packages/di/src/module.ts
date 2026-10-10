import type { Actored, Command, DependencyKind, Message, MessageInfo, MessageType, Query, ScheduledJob } from '@ddd-ts-kit/kernel';
import type {
  BindingAspect,
  BindingAspectInfo,
  DependencyList,
  DependencyTokens,
  MessageHandler,
  ScheduledOptions,
} from '@ddd-ts-kit/kernel/declarations';
import type { ConsumerOptions, EventContract, IntegrationEventHandler } from './consumer.js';
import { consumptionOf, includeDeclared, type DeclaredSource } from './declared.js';
import { WiringError } from './errors.js';
import { writtenJob } from './jobs.js';
import { describeToken, token, type Token } from './token.js';
import {
  PUBLIC_REQUIREMENT,
  declaredRequirement,
  protectedRequirement,
  type PermissionRef,
  type Requirement,
  type RequirementOptions,
} from './use-case-access.js';
import {
  addBinding,
  addHandling,
  addConsumption,
  addJob,
  classRecipe,
  emptyDraft,
  factoryRecipe,
  replaceBinding,
  type Binding,
  type Recipe,
  type Resolve,
  type Wiring,
  type WiringDraft,
} from './wiring.js';

export type {
  AnyMessageHandler,
  Binding,
  BindingSource,
  Lifetime,
  MessageHandling,
  Resolve,
  Wiring,
} from './wiring.js';
export type { BindingAspect, BindingAspectInfo, DependencyList, DependencyTokens, MessageHandler };
export type { DependencyKind };

export interface ValueBindingOptions {
  /** Role passed to the `decorate` hook of the application. */
  as(kind: DependencyKind): this;
  /**
   * Wraps every instance of this binding, the first aspect outermost:
   * `.with(retry(...), timeout(2000))` bounds each attempt. The `decorate` hook of the
   * application comes around them. A value that is not an object is left alone.
   */
  with(...aspects: readonly BindingAspect[]): this;
}

export interface BindingOptions extends ValueBindingOptions {
  /** One instance per application. The default. */
  singleton(): this;
  /** A new instance on every resolution. */
  transient(): this;
}

export interface BindingTarget<T> {
  /** The class needs no decorator: its constructor arguments are the listed tokens. */
  toClass<Args extends readonly unknown[]>(
    implementation: new (...args: Args) => T,
    ...dependencies: DependencyList<Args>
  ): BindingOptions;
  toFactory(factory: (resolve: Resolve) => T): BindingOptions;
  toValue(value: T): ValueBindingOptions;
}

export interface HandlerTarget<Handler> {
  /** Binds the class as a singleton; its constructor arguments are the listed tokens. */
  handledBy<Args extends readonly unknown[]>(
    handler: new (...args: Args) => Handler,
    ...dependencies: DependencyList<Args>
  ): void;
  handledByFactory(factory: (resolve: Resolve) => Handler): void;
}

export interface UseCaseTarget<M extends Message> extends HandlerTarget<MessageHandler<M>> {
  /** Anybody reaches the handler, the anonymous caller included. Said, never implied. */
  public(): HandlerTarget<MessageHandler<M>>;
}

/**
 * Offered only for a message that carries its actor (`AuthorizedCommand`, `AuthorizedQuery`,
 * or any message declaring `readonly actor: Actor`): a right is always somebody's.
 */
export interface ProtectedUseCaseTarget<M extends Message> extends UseCaseTarget<M> {
  /** Only an actor holding the permission reaches the handler. */
  requires(permission: PermissionRef, options?: RequirementOptions<M>): HandlerTarget<MessageHandler<M>>;
}

export interface ModuleBuilder {
  bind<T>(token: Token<T>): BindingTarget<T>;
  /**
   * Replaces the binding of a module listed earlier, typically a default of `kernelModule()`
   * (a database unit of work, an outbox publisher). `bind` refuses a token bound twice.
   */
  rebind<T>(token: Token<T>): BindingTarget<T>;
  /** Declares the one handler of a command: bound as a use case and registered on `COMMAND_BUS`. */
  command<C extends Command<unknown> & Actored>(type: MessageType<C>): ProtectedUseCaseTarget<C>;
  command<C extends Command<unknown>>(type: MessageType<C>): UseCaseTarget<C>;
  /** Declares the one handler of a query: bound as a use case and registered on `QUERY_BUS`. */
  query<Q extends Query<unknown> & Actored>(type: MessageType<Q>): ProtectedUseCaseTarget<Q>;
  query<Q extends Query<unknown>>(type: MessageType<Q>): UseCaseTarget<Q>;
  /**
   * Declares the handler of an integration event, under a consumer name: subscribed to `EVENT_SUBSCRIBER` when the
   * application starts, unsubscribed when it stops. Each event is handled inside
   * `EXECUTION_SCOPE`, in a context of origin `event` that continues its correlation.
   */
  on<Payload>(
    contract: EventContract<Payload>,
    options: ConsumerOptions,
  ): HandlerTarget<IntegrationEventHandler<Payload>>;
  /**
   * Declares a job run by time, under its name: bound as a singleton and registered on
   * `JOB_SCHEDULER`. `builder.job('billing.send-reminders', { every: '15m' }).handledBy(SendReminders, [COMMAND_BUS])`.
   */
  job(name: string, settings: ScheduledOptions): HandlerTarget<ScheduledJob>;
  /**
   * Adds classes that declare themselves with the decorators of `@ddd-ts-kit/kernel/declarations`:
   * a class, a list of them, or a namespace import of a barrel. `contextModule` is this call
   * alone; here it mixes with the explicit statements of one module.
   */
  include(declared: DeclaredSource): void;
}

export interface ModuleContext {
  readonly resolve: Resolve;
}

export interface ContextModule {
  /** The bounded context's name; passed to the `decorate` hook as `context`. */
  readonly name: string;
  register(builder: ModuleBuilder): void;
  onStart?(context: ModuleContext): void | Promise<void>;
  onStop?(context: ModuleContext): void | Promise<void>;
}

/** Identity function that types a module definition and keeps it immutable. */
export function defineContextModule(definition: ContextModule): ContextModule {
  return Object.freeze({ ...definition });
}

/** Runs the `register` function of every module and returns what they declared. */
export function collectWiring(modules: readonly ContextModule[]): Wiring {
  const draft = emptyDraft();
  for (const module of modules) {
    const recorder = new ModuleRecorder(module.name, draft);
    module.register(recorder);
    recorder.assertNothingLeftUnfinished();
  }
  return { modules: modules.map((module) => module.name), ...draft };
}

interface HandlerDeclaration<Handler> {
  /** The statement as the module wrote it, for error messages and factory handler names. */
  readonly statement: string;
  readonly kind: DependencyKind;
  record(handler: Token<Handler>): void;
}

class ModuleRecorder implements ModuleBuilder {
  readonly #unfinished = new Set<symbol>();

  constructor(
    private readonly module: string,
    private readonly draft: WiringDraft,
  ) {}

  // The builder methods are arrow properties: a `register` function may destructure them.
  readonly bind = <T>(target: Token<T>): BindingTarget<T> => this.#bindingTarget('bind', target);

  readonly rebind = <T>(target: Token<T>): BindingTarget<T> => this.#bindingTarget('rebind', target);

  readonly command = <C extends Command<unknown>>(type: MessageType<C>): ProtectedUseCaseTarget<C> =>
    this.#useCase('command', type);

  readonly query = <Q extends Query<unknown>>(type: MessageType<Q>): ProtectedUseCaseTarget<Q> =>
    this.#useCase('query', type);

  readonly on = <Payload>(
    contract: EventContract<Payload>,
    options: ConsumerOptions,
  ): HandlerTarget<IntegrationEventHandler<Payload>> =>
    this.#handlerTarget<IntegrationEventHandler<Payload>>({
      statement: `on(${contract.type})`,
      kind: 'consumer',
      record: (handler) => addConsumption(this.draft, consumptionOf({ contract, options, handler, module: this.module })),
    });

  readonly job = (name: string, settings: ScheduledOptions): HandlerTarget<ScheduledJob> =>
    this.#handlerTarget<ScheduledJob>({
      statement: `job(${name})`,
      kind: 'job',
      record: (job) => addJob(this.draft, writtenJob(name, settings, { job, module: this.module })),
    });

  readonly include = (declared: DeclaredSource): void => {
    includeDeclared({ draft: this.draft, module: this.module }, declared);
  };

  assertNothingLeftUnfinished(): void {
    const [statement] = this.#unfinished;
    if (statement !== undefined) {
      throw new WiringError(
        'INCOMPLETE_BINDING',
        `Module "${this.module}" calls ${statement.description}.`,
      );
    }
  }

  #bindingTarget<T>(verb: 'bind' | 'rebind', target: Token<T>): BindingTarget<T> {
    const finish = this.#begin(
      `${verb}("${describeToken(target)}") without toClass, toFactory or toValue`,
    );
    const add = (recipe: Recipe): BindingOptions => {
      finish();
      const binding = this.#bindingOf(target, recipe);
      if (verb === 'bind') addBinding(this.draft, binding);
      else replaceBinding(this.draft, binding);
      return optionsOf(binding);
    };
    return {
      toClass(
        implementation: new (...args: never) => T,
        ...rest: readonly [dependencies?: readonly Token<unknown>[]]
      ) {
        return add(classRecipe(implementation, rest[0]));
      },
      toFactory: (factory) => add(factoryRecipe(factory)),
      toValue: (value) => add({ source: 'value', dependencies: [], create: () => value }),
    };
  }

  #begin(statement: string): () => void {
    const unfinished = Symbol(statement);
    this.#unfinished.add(unfinished);
    return () => void this.#unfinished.delete(unfinished);
  }

  #bindingOf(target: Token<unknown>, recipe: Recipe): Binding {
    return { token: target, module: this.module, lifetime: 'singleton', aspects: [], ...recipe };
  }

  #useCase<M extends Message>(kind: MessageInfo['kind'], message: MessageType<M>): ProtectedUseCaseTarget<M> {
    let requirement = declaredRequirement(message);
    const target = this.#handlerTarget<MessageHandler<M>>({
      statement: `${kind}(${message.name})`,
      kind: 'use-case',
      record: (handler) => addHandling(this.draft, { kind, message, handler, module: this.module, requirement }),
    });
    const declaring = (declared: Requirement): HandlerTarget<MessageHandler<M>> => {
      requirement = declared;
      return target;
    };
    return {
      ...target,
      requires: (permission, options) => declaring(protectedRequirement(message, permission, options)),
      public: () => declaring(PUBLIC_REQUIREMENT),
    };
  }

  #handlerTarget<Handler>(declaration: HandlerDeclaration<Handler>): HandlerTarget<Handler> {
    const { statement, kind } = declaration;
    const finish = this.#begin(`${statement} without handledBy or handledByFactory`);
    const add = (name: string, recipe: Recipe): void => {
      finish();
      const handler = token<Handler>(name);
      addBinding(this.draft, { ...this.#bindingOf(handler, recipe), kind });
      declaration.record(handler);
    };
    return {
      handledBy(
        implementation: new (...args: never) => Handler,
        ...rest: readonly [dependencies?: readonly Token<unknown>[]]
      ) {
        add(implementation.name, classRecipe(implementation, rest[0]));
      },
      handledByFactory: (factory) => add(`${statement} handler`, factoryRecipe(factory)),
    };
  }
}

function optionsOf(binding: Binding): BindingOptions {
  const options: BindingOptions = {
    as(kind) {
      binding.kind = kind;
      return options;
    },
    singleton() {
      binding.lifetime = 'singleton';
      return options;
    },
    transient() {
      binding.lifetime = 'transient';
      return options;
    },
    with(...aspects) {
      binding.aspects = [...binding.aspects, ...aspects];
      return options;
    },
  };
  return options;
}
