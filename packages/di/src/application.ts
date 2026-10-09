import type { Message, MessageInfo, MessageType, Subscription } from '@ddd-ts-kit/kernel';
import { container as rootContainer, instanceCachingFactory, type DependencyContainer } from 'tsyringe';
import {
  DECLARED_POLICIES,
  USE_CASE_DECLARATIONS,
  USE_CASE_GUARD,
  assertAuthorizationDeclared,
  declarationsOf,
  passEveryMessage,
  type AuthorizationMode,
} from './authorization.js';
import { assertSound, cycleError } from './checks.js';
import { describeWiring, type WiringDescription } from './description.js';
import { WiringError } from './errors.js';
import type { ConsumerRuntime } from './consumer.js';
import {
  COMMAND_BUS,
  DOMAIN_EVENTS,
  EVENT_SUBSCRIBER,
  EXECUTION_SCOPE,
  PROCESSED_EVENTS,
  QUERY_BUS,
} from './kernel-tokens.js';
import {
  collectWiring,
  type AnyMessageHandler,
  type Binding,
  type BindingAspectInfo,
  type ContextModule,
  type DependencyKind,
  type MessageHandling,
  type Resolve,
  type Wiring,
} from './module.js';
import { describeToken, type Token } from './token.js';

export interface BindingInfo {
  readonly token: Token<unknown>;
  /** Name of the module that declared the binding. */
  readonly context: string;
  /** Present when the binding was declared with `.as(kind)`. */
  readonly kind?: DependencyKind;
}

/**
 * Applied to every instance a binding creates, once per creation. This is where a
 * project plugs cross-cutting wrappers (tracing, metrics) without the wrapped class
 * knowing. It must return the instance or a stand-in of the same type.
 */
export type Decorate = <T>(instance: T, info: BindingInfo) => T;

export type Override = readonly [token: Token<unknown>, value: unknown];

/** A type-checked override pair for `createApplication({ overrides })`. */
export function override<T>(target: Token<T>, value: T): Override {
  return [target, value];
}

export interface ApplicationOptions {
  readonly modules: readonly ContextModule[];
  readonly decorate?: Decorate;
  /** Values that replace bindings, typically fakes in tests. They are not decorated. */
  readonly overrides?: readonly Override[];
  /**
   * `required` refuses to create an application in which a command or a query declares neither
   * `.requires(permission)` nor `.public()`, or in which nothing checks them. Default `optional`.
   */
  readonly authorization?: AuthorizationMode;
}

export interface Application {
  readonly resolve: Resolve;
  /** Calls `onStart` of every module, in declaration order, then subscribes the consumers. */
  start(): Promise<void>;
  /** Unsubscribes the consumers, then calls `onStop` of every started module, in reverse order. */
  stop(): Promise<void>;
  /** The wiring as plain data, for diagnostics and generated documentation. */
  describe(): WiringDescription;
  /** The underlying tsyringe child container, for interoperability. */
  readonly container: DependencyContainer;
}

/**
 * Wires the modules into a tsyringe child container (so two applications, or two tests,
 * never share instances) and checks the graph before anything is instantiated. The command
 * and query buses are then resolved to receive the declared handlers; a handler itself is
 * instantiated on the first message it handles.
 */
export function createApplication(options: ApplicationOptions): Application {
  return assemble(collectWiring(options.modules), options);
}

/** `createApplication` for callers that already collected the wiring to inspect it. */
export function assemble(wiring: Wiring, options: ApplicationOptions): Application {
  const overrides = options.overrides ?? [];
  const overridden = new Set(overrides.map(([target]) => target));
  assertSound(wiring, overridden);
  if (options.authorization === 'required') assertAuthorizationDeclared(wiring, overridden);
  return new ContainerApplication(wiring, options);
}

/**
 * Swaps a binding for a fake after the application was created. Call it before the
 * first `resolve`: a singleton already built keeps the dependency it was given.
 */
export function overrideForTests<T>(application: Application, target: Token<T>, value: T): void {
  if (!(application instanceof ContainerApplication)) {
    throw new TypeError('Not an application made by createApplication.');
  }
  application.replace(target, value);
}

const BUS_OF: Readonly<Record<MessageInfo['kind'], Token<unknown>>> = {
  command: COMMAND_BUS,
  query: QUERY_BUS,
};

class ContainerApplication implements Application {
  readonly container = rootContainer.createChildContainer();
  readonly #overridden = new Set<Token<unknown>>();
  // Tokens under construction: a factory asking for one of them is a cycle that the
  // static check cannot see, since factories do not declare their dependencies.
  readonly #resolving: Token<unknown>[] = [];
  readonly #started: ContextModule[] = [];
  #subscriptions: Subscription[] | undefined;

  constructor(
    private readonly wiring: Wiring,
    private readonly options: ApplicationOptions,
  ) {
    // Registered first: a module binding or an override of the guard comes later and wins.
    this.container.register(USE_CASE_GUARD, { useValue: passEveryMessage });
    this.container.register(USE_CASE_DECLARATIONS, { useValue: declarationsOf(wiring) });
    this.container.register(DECLARED_POLICIES, { useValue: wiring.policies });
    for (const binding of wiring.bindings.values()) this.#register(binding);
    for (const [target, value] of options.overrides ?? []) this.#registerValue(target, value);
    this.#registerHandlers('command');
    this.#registerHandlers('query');
    this.#attachReactions();
  }

  // Arrow properties, here and below: callers destructure them and pass them around.
  readonly resolve: Resolve = <T>(target: Token<T>): T => {
    if (!this.container.isRegistered(target)) throw this.#unboundError(target);
    const loopStart = this.#resolving.indexOf(target);
    if (loopStart !== -1) throw cycleError([...this.#resolving.slice(loopStart), target]);
    this.#resolving.push(target);
    try {
      return this.container.resolve<T>(target);
    } finally {
      this.#resolving.pop();
    }
  };

  readonly start = async (): Promise<void> => {
    for (const module of this.options.modules) {
      if (this.#started.includes(module)) continue;
      // Recorded first: a module whose start failed half-way still gets its onStop.
      this.#started.push(module);
      await module.onStart?.({ resolve: this.resolve });
    }
    this.#subscriptions ??= this.#subscribeConsumers();
  };

  readonly stop = async (): Promise<void> => {
    const failures = [...this.#unsubscribeConsumers(), ...(await this.#stopModules())];
    if (failures.length > 0) {
      throw new AggregateError(failures, `${failures.length} module(s) failed to stop`);
    }
  };

  readonly describe = (): WiringDescription => describeWiring(this.wiring, this.#overridden);

  replace(target: Token<unknown>, value: unknown): void {
    this.#registerValue(target, value);
    if (target === COMMAND_BUS) this.#registerHandlers('command');
    if (target === QUERY_BUS) this.#registerHandlers('query');
    if (target === DOMAIN_EVENTS) this.#attachReactions();
  }

  #register(binding: Binding): void {
    const info: BindingInfo = {
      token: binding.token,
      context: binding.module,
      ...(binding.kind === undefined ? {} : { kind: binding.kind }),
    };
    const { decorate } = this.options;
    const create = (): unknown => {
      const instance = withBindingAspects(binding.create(this.resolve), binding);
      return decorate === undefined ? instance : decorate(instance, info);
    };
    // tsyringe refuses Lifecycle.Singleton on factory providers; its caching factory
    // is the supported way to get one instance per container.
    this.container.register(binding.token, {
      useFactory: binding.lifetime === 'singleton' ? instanceCachingFactory(create) : create,
    });
  }

  #registerValue(target: Token<unknown>, value: unknown): void {
    // tsyringe resolves the most recent registration of a token.
    this.container.register(target, { useValue: value });
    this.#overridden.add(target);
  }

  #registerHandlers(kind: MessageInfo['kind']): void {
    const handlings = this.wiring.handlings.filter((handling) => handling.kind === kind);
    if (handlings.length === 0) return;
    const bus = this.resolve(BUS_OF[kind]);
    if (!isHandlerRegistry(bus)) {
      throw new WiringError(
        'BUS_WITHOUT_REGISTER',
        `"${describeToken(BUS_OF[kind])}" has no register(type, handler) method, so the ${handlings.length} ${kind} handler(s) declared by the modules cannot be attached to it. Bind an in-process bus, or register the handlers where the bus runs.`,
      );
    }
    for (const handling of handlings) bus.register(handling.message, this.#lazily(handling));
  }

  #attachReactions(): void {
    const { reactions } = this.wiring;
    if (reactions.length === 0) return;
    const dispatcher = this.resolve(DOMAIN_EVENTS);
    for (const reaction of reactions) reaction.attach(this.resolve, dispatcher);
  }

  // Async so that a handler failing to be built rejects the execution instead of throwing
  // through the bus middlewares synchronously.
  #lazily(handling: MessageHandling): AnyMessageHandler {
    return { execute: async (message) => this.resolve(handling.handler).execute(message) };
  }

  #unboundError(target: Token<unknown>): WiringError {
    const requester = this.#resolving.at(-1);
    const asked = requester === undefined ? '' : `, required by "${describeToken(requester)}"`;
    return new WiringError('UNBOUND_TOKEN', `No module binds "${describeToken(target)}"${asked}.`);
  }

  #subscribeConsumers(): Subscription[] {
    const { consumptions } = this.wiring;
    if (consumptions.length === 0) return [];
    const subscriber = this.resolve(EVENT_SUBSCRIBER);
    const runtime = this.#consumerRuntime();
    return consumptions.map((consumption) =>
      subscriber.subscribe(consumption.type, consumption.subscribe(this.resolve, runtime)),
    );
  }

  #consumerRuntime(): ConsumerRuntime {
    const processed = this.#resolveIfBound(PROCESSED_EVENTS);
    const scope = this.#resolveIfBound(EXECUTION_SCOPE);
    return {
      ...(processed === undefined ? {} : { processed }),
      ...(scope === undefined ? {} : { scope }),
    };
  }

  #resolveIfBound<T>(target: Token<T>): T | undefined {
    return this.container.isRegistered(target) ? this.resolve(target) : undefined;
  }

  #unsubscribeConsumers(): unknown[] {
    const subscriptions = this.#subscriptions ?? [];
    this.#subscriptions = undefined;
    return failuresOf(subscriptions.map((subscription) => () => subscription.unsubscribe()));
  }

  async #stopModules(): Promise<unknown[]> {
    const failures: unknown[] = [];
    for (const module of this.#started.splice(0).reverse()) {
      try {
        await module.onStop?.({ resolve: this.resolve });
      } catch (error) {
        failures.push(error);
      }
    }
    return failures;
  }
}

function withBindingAspects(instance: unknown, binding: Binding): unknown {
  if (binding.aspects.length === 0 || typeof instance !== 'object' || instance === null) return instance;
  const info: BindingAspectInfo = {
    className: binding.implementation ?? constructorNameOf(instance),
    context: binding.module,
    token: describeToken(binding.token),
    ...(binding.kind === undefined ? {} : { kind: binding.kind }),
  };
  return binding.aspects.reduceRight((wrapped, aspect) => aspect(wrapped, info), instance);
}

function constructorNameOf(instance: object): string {
  const prototype: unknown = Object.getPrototypeOf(instance);
  const constructor: unknown =
    typeof prototype === 'object' && prototype !== null && 'constructor' in prototype
      ? prototype.constructor
      : undefined;
  return typeof constructor === 'function' ? constructor.name : 'Object';
}

interface HandlerRegistry {
  register(type: MessageType<Message>, handler: AnyMessageHandler): unknown;
}

function isHandlerRegistry(bus: unknown): bus is HandlerRegistry {
  return typeof bus === 'object' && bus !== null && 'register' in bus && typeof bus.register === 'function';
}

function failuresOf(attempts: readonly (() => void)[]): unknown[] {
  return attempts.flatMap((attempt) => {
    try {
      attempt();
      return [];
    } catch (error) {
      return [error];
    }
  });
}
