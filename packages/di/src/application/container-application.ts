import {
  CommandBus,
  DomainEventDispatcher,
  JobScheduler,
  QueryBus,
  type MessageInfo,
} from '@ddd-ts-kit/kernel';
import { describeToken, tokenIdentity, type Token } from '@ddd-ts-kit/kernel/declarations';
import { container as rootContainer, instanceCachingFactory } from 'tsyringe';
import { DeclaredPolicies } from '../authorization/declared-policies.js';
import { declarationsOf } from '../authorization/declarations-of.js';
import { passEveryMessage } from '../authorization/pass-every-message.js';
import { UseCaseDeclarations } from '../authorization/use-case-declarations.js';
import { UseCaseGuard } from '../authorization/use-case-guard.js';
import { cycleError } from '../checks/cycle-error.js';
import { describeWiring } from '../description/describe-wiring.js';
import type { WiringDescription } from '../description/wiring-description.js';
import { WiringError } from '../errors/wiring-error.js';
import type { EffectiveJob } from '../jobs/effective-job.js';
import type { ContextModule } from '../module/context-module.js';
import { sameToken } from '../token/same-token.js';
import { TokenSet } from '../token/token-set.js';
import type { AnyMessageHandler } from '../wiring/any-message-handler.js';
import type { Binding } from '../wiring/binding.js';
import type { MessageHandling } from '../wiring/message-handling.js';
import type { Resolve } from '../wiring/resolve.js';
import type { Wiring } from '../wiring/wiring.js';
import type { ApplicationOptions } from './application-options.js';
import type { Application } from './application.js';
import type { BindingInfo } from './binding-info.js';
import { ConsumerSubscriptions } from './consumer-subscriptions.js';
import { isHandlerRegistry } from './is-handler-registry.js';
import { JobLifecycle } from './job-lifecycle.js';
import { withBindingAspects } from './with-binding-aspects.js';

const BUS_OF: Readonly<Record<MessageInfo['kind'], Token<unknown>>> = {
  command: CommandBus,
  query: QueryBus,
};

/*
 * No member is named after one of the test kernel (`jobs`, `clock`, `eventBus`...): the test
 * application lays those over this object, and would replace a private field of the same name.
 */
export class ContainerApplication implements Application {
  readonly container = rootContainer.createChildContainer();

  private readonly overridden = new TokenSet();

  // Tokens under construction: a factory asking for one of them is a cycle that the
  // static check cannot see, since factories do not declare their dependencies.
  private readonly resolving: Token<unknown>[] = [];

  private readonly started: ContextModule[] = [];

  private readonly consumerSubscriptions: ConsumerSubscriptions;

  private readonly jobLifecycle: JobLifecycle;

  constructor(
    private readonly wiring: Wiring,
    private readonly options: ApplicationOptions,
    effectiveJobs: readonly EffectiveJob[],
  ) {
    const ports = { resolve: this.resolve, isBound: (target: Token<unknown>) => this.isBound(target) };

    this.consumerSubscriptions = new ConsumerSubscriptions(wiring.consumptions, ports);
    this.jobLifecycle = new JobLifecycle(effectiveJobs, this.resolve, options.jobs?.start !== false);
    // Registered first: a module binding or an override of the guard comes later and wins.
    this.provide(UseCaseGuard, passEveryMessage);
    this.provide(UseCaseDeclarations, { list: declarationsOf(wiring) });
    this.provide(DeclaredPolicies, { list: wiring.policies });

    for (const binding of wiring.bindings.values()) this.register(binding);

    for (const [target, value] of options.overrides ?? []) this.registerValue(target, value);

    this.registerHandlers('command');
    this.registerHandlers('query');
    this.attachDomainEventHandlers();
    this.jobLifecycle.register();
  }

  // Arrow properties, here and below: callers destructure them and pass them around.
  readonly resolve: Resolve = <T>(target: Token<T>): T => {
    if (!this.isBound(target)) throw this.unboundError(target);

    const loopStart = this.resolving.findIndex((step) => sameToken(step, target));

    if (loopStart !== -1) throw cycleError([...this.resolving.slice(loopStart), target]);

    this.resolving.push(target);

    try {
      return this.container.resolve<T>(tokenIdentity(target));
    } finally {
      this.resolving.pop();
    }
  };

  /** The jobs come after the consumers: a job sends commands whose events must find their handlers subscribed. */
  readonly start = async (): Promise<void> => {
    for (const module of this.options.modules) {
      if (this.started.includes(module)) continue;

      // Recorded first: a module whose start failed half-way still gets its onStop.
      this.started.push(module);
      await module.onStart?.({ resolve: this.resolve });
    }

    this.consumerSubscriptions.subscribe();
    await this.jobLifecycle.start();
  };

  /** The jobs go first: the runs in progress end, or are aborted, while everything they use is still up. */
  readonly stop = async (): Promise<void> => {
    const failures = [
      ...(await this.jobLifecycle.stop()),
      ...this.consumerSubscriptions.unsubscribe(),
      ...(await this.stopModules()),
    ];

    if (failures.length > 0) {
      throw new AggregateError(failures, `${failures.length} module(s) failed to stop`);
    }
  };

  readonly describe = (): WiringDescription =>
    describeWiring(this.wiring, this.overridden, this.jobLifecycle.jobs);

  replace(target: Token<unknown>, value: unknown): void {
    this.registerValue(target, value);

    if (sameToken(target, CommandBus)) this.registerHandlers('command');

    if (sameToken(target, QueryBus)) this.registerHandlers('query');

    if (sameToken(target, DomainEventDispatcher)) this.attachDomainEventHandlers();

    if (sameToken(target, JobScheduler)) this.jobLifecycle.register();
  }

  private isBound(target: Token<unknown>): boolean {
    return this.container.isRegistered(tokenIdentity(target));
  }

  private unboundError(target: Token<unknown>): WiringError {
    const requester = this.resolving.at(-1);
    const asked = requester === undefined ? '' : `, required by "${describeToken(requester)}"`;

    return new WiringError('UNBOUND_TOKEN', `No module binds "${describeToken(target)}"${asked}.`);
  }

  private provide<T>(target: Token<T>, value: T): void {
    this.container.register(tokenIdentity(target), { useValue: value });
  }

  private register(binding: Binding): void {
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
    this.container.register(tokenIdentity(binding.token), {
      useFactory: binding.lifetime === 'singleton' ? instanceCachingFactory(create) : create,
    });
  }

  private registerValue(target: Token<unknown>, value: unknown): void {
    // tsyringe resolves the most recent registration of a token.
    this.provide(target, value);
    this.overridden.add(target);
  }

  private registerHandlers(kind: MessageInfo['kind']): void {
    const handlings = this.wiring.handlings.filter((handling) => handling.kind === kind);

    if (handlings.length === 0) return;

    const bus = this.resolve(BUS_OF[kind]);

    if (!isHandlerRegistry(bus)) {
      throw new WiringError(
        'BUS_WITHOUT_REGISTER',
        `"${describeToken(BUS_OF[kind])}" has no register(type, handler) method, so the ${handlings.length} ${kind} handler(s) declared by the modules cannot be attached to it. Bind an in-process bus, or register the handlers where the bus runs.`,
      );
    }

    for (const handling of handlings) bus.register(handling.message, this.lazily(handling));
  }

  // Async so that a handler failing to be built rejects the execution instead of throwing
  // through the bus middlewares synchronously.
  private lazily(handling: MessageHandling): AnyMessageHandler {
    return { execute: async (message) => this.resolve(handling.handler).execute(message) };
  }

  private attachDomainEventHandlers(): void {
    const { domainEventHandlers } = this.wiring;

    if (domainEventHandlers.length === 0) return;

    const dispatcher = this.resolve(DomainEventDispatcher);

    for (const handling of domainEventHandlers) handling.attach(this.resolve, dispatcher);
  }

  private async stopModules(): Promise<unknown[]> {
    const failures: unknown[] = [];

    for (const module of this.started.splice(0).reverse()) {
      try {
        await module.onStop?.({ resolve: this.resolve });
      } catch (error) {
        failures.push(error);
      }
    }

    return failures;
  }
}
