import type {
  Actored,
  Command,
  IntegrationEventHandler,
  Message,
  MessageInfo,
  MessageType,
  ProcessedEventStore,
  Query,
  ResultOf,
} from '@ddd-ts-kit/kernel';
import { receive, type ConsumerOptions, type EventConsumer, type EventContract } from './consumer.js';
import { WiringError } from './errors.js';
import { describeToken, token, type Token } from './token.js';
import {
  PUBLIC_REQUIREMENT,
  protectedRequirement,
  type PermissionRef,
  type Requirement,
  type RequirementOptions,
} from './use-case-access.js';

export type DependencyKind =
  | 'repository'
  | 'gateway'
  | 'external'
  | 'use-case'
  | 'publisher'
  | 'consumer';

export type Lifetime = 'singleton' | 'transient';

export type Resolve = <T>(token: Token<T>) => T;

/** One token per constructor parameter, in order, each resolving to that parameter's type. */
export type DependencyTokens<Args extends readonly unknown[]> = {
  readonly [Index in keyof Args]: Token<Args[Index]>;
};

/** The token list of a constructor, which may only be left out when it takes no parameter. */
export type DependencyList<Args extends readonly unknown[]> = Args extends readonly []
  ? [dependencies?: readonly []]
  : [dependencies: DependencyTokens<Args>];

/** What a binding aspect is told about the instance it wraps. */
export interface BindingAspectInfo {
  readonly kind?: DependencyKind;
  /** The bound class, or the constructor name of what a factory or a value gave. */
  readonly className: string;
  /** Name of the module that declared the binding. */
  readonly context: string;
  /** Description of the bound token. */
  readonly token: string;
}

/**
 * Cross-cutting behaviour put around one binding: it answers the instance or a stand-in of the
 * same type. An `Aspect` of `@ddd-ts-kit/aspects` fits as it is; this package does not depend
 * on it.
 */
export type BindingAspect = <T extends object>(instance: T, info: BindingAspectInfo) => T;

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

/**
 * What handles a command or a query. `execute` is declared as a property so that the compiler
 * compares its parameter strictly: the handler of another message is rejected.
 */
export interface MessageHandler<M extends Message> {
  readonly execute: (message: M) => Promise<ResultOf<M>>;
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
   * Declares a consumer of an integration event: subscribed to `EVENT_SUBSCRIBER` when the
   * application starts, unsubscribed when it stops.
   */
  on<Payload>(
    contract: EventContract<Payload>,
    options: ConsumerOptions,
  ): HandlerTarget<EventConsumer<Payload>>;
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

export type BindingSource = 'class' | 'factory' | 'value';

export interface Binding {
  readonly token: Token<unknown>;
  readonly module: string;
  readonly source: BindingSource;
  readonly implementation?: string;
  /** Known only for a class: factories resolve what they want at run time. */
  readonly dependencies: readonly Token<unknown>[];
  readonly create: (resolve: Resolve) => unknown;
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
  /** Empty when the module declared no access for the use case. */
  readonly requirement: Requirement;
}

interface EventConsumption {
  readonly type: string;
  readonly version: number;
  readonly consumer: string;
  readonly handler: Token<unknown>;
  readonly module: string;
  readonly subscribe: (
    resolve: Resolve,
    processed: ProcessedEventStore | undefined,
  ) => IntegrationEventHandler;
}

export interface Wiring {
  readonly modules: readonly string[];
  readonly bindings: ReadonlyMap<Token<unknown>, Binding>;
  readonly handlings: readonly MessageHandling[];
  readonly consumptions: readonly EventConsumption[];
}

interface WiringDraft {
  readonly bindings: Map<Token<unknown>, Binding>;
  readonly handlings: MessageHandling[];
  readonly consumptions: EventConsumption[];
}

/** Runs the `register` function of every module and returns what they declared. */
export function collectWiring(modules: readonly ContextModule[]): Wiring {
  const draft: WiringDraft = { bindings: new Map(), handlings: [], consumptions: [] };
  for (const module of modules) {
    const recorder = new ModuleRecorder(module.name, draft);
    module.register(recorder);
    recorder.assertNothingLeftUnfinished();
  }
  return { modules: modules.map((module) => module.name), ...draft };
}

type Recipe = Pick<Binding, 'source' | 'implementation' | 'dependencies' | 'create'>;

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
    { consumer }: ConsumerOptions,
  ): HandlerTarget<EventConsumer<Payload>> =>
    this.#handlerTarget<EventConsumer<Payload>>({
      statement: `on(${contract.type})`,
      kind: 'consumer',
      record: (handler) =>
        this.#recordConsumption({
          type: contract.type,
          version: contract.version,
          consumer,
          handler,
          module: this.module,
          subscribe: (resolve, processed) =>
            receive({
              contract,
              consumer,
              processed,
              handle: (event) => resolve(handler).handle(event),
            }),
        }),
    });

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
      if (verb === 'bind') this.#declare(binding);
      else this.#replace(binding);
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

  #declare(binding: Binding): void {
    const existing = this.draft.bindings.get(binding.token);
    if (existing !== undefined) {
      throw new WiringError(
        'DUPLICATE_BINDING',
        `Token "${describeToken(binding.token)}" is bound twice: by module "${existing.module}" and by module "${this.module}".`,
      );
    }
    this.draft.bindings.set(binding.token, binding);
  }

  #replace(binding: Binding): void {
    if (!this.draft.bindings.has(binding.token)) {
      throw new WiringError(
        'NOTHING_TO_REBIND',
        `Module "${this.module}" rebinds "${describeToken(binding.token)}", which no earlier module binds. List the module that binds it first, or use bind.`,
      );
    }
    this.draft.bindings.set(binding.token, binding);
  }

  #useCase<M extends Message>(kind: MessageInfo['kind'], message: MessageType<M>): ProtectedUseCaseTarget<M> {
    let requirement: Requirement = {};
    const target = this.#handlerTarget<MessageHandler<M>>({
      statement: `${kind}(${message.name})`,
      kind: 'use-case',
      record: (handler) => this.#recordHandling({ kind, message, handler, module: this.module, requirement }),
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
      this.#declare({ ...this.#bindingOf(handler, recipe), kind });
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

  #recordHandling(handling: MessageHandling): void {
    const existing = this.draft.handlings.find(
      (other) => other.kind === handling.kind && other.message === handling.message,
    );
    if (existing !== undefined) {
      throw new WiringError(
        'DUPLICATE_HANDLER',
        `The ${handling.kind} "${handling.message.name}" has two handlers: "${describeToken(existing.handler)}" in module "${existing.module}" and "${describeToken(handling.handler)}" in module "${this.module}".`,
      );
    }
    this.draft.handlings.push(handling);
  }

  #recordConsumption(consumption: EventConsumption): void {
    const { consumer, type, version } = consumption;
    const existing = this.draft.consumptions.find(
      (other) => other.consumer === consumer && other.type === type && other.version === version,
    );
    if (existing !== undefined) {
      throw new WiringError(
        'DUPLICATE_CONSUMER',
        `Consumer "${consumer}" is declared twice for ${type} v${version}: in module "${existing.module}" and in module "${this.module}". Sharing a name would make one of them skip every event.`,
      );
    }
    this.draft.consumptions.push(consumption);
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

function classRecipe(
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

function factoryRecipe(factory: (resolve: Resolve) => unknown): Recipe {
  return { source: 'factory', dependencies: [], create: factory };
}
