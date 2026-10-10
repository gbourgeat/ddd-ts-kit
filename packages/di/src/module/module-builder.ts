import type { Actored, Command, DependencyKind, MessageType, Query, ScheduledJob } from '@ddd-ts-kit/kernel';
import type {
  BindingAspect,
  EventContract,
  IntegrationEventHandler,
  ScheduledOptions,
  Token,
} from '@ddd-ts-kit/kernel/declarations';
import type { ConsumerOptions } from '../consumer/consumer-options.js';
import type { DeclaredSource } from '../declared/declared-source.js';
import type { Resolve } from '../wiring/resolve.js';
import type { BindingTarget } from './binding-target.js';
import type { HandlerTarget } from './handler-target.js';
import type { ProtectedUseCaseTarget } from './protected-use-case-target.js';
import type { UseCaseTarget } from './use-case-target.js';

export interface ModuleBuilder {
  /** Binds a port, or the abstract class that types a value: `builder.bind(OrderRepository)`. */
  bind<T>(port: Token<T>): BindingTarget<T>;

  /**
   * Replaces the binding of a module listed earlier, typically a default of `kernelModule()`
   * (a database unit of work, an outbox publisher). `bind` refuses a port bound twice.
   */
  rebind<T>(port: Token<T>): BindingTarget<T>;

  /** Declares the one handler of a command: bound as a use case and registered on the `CommandBus`. */
  command<C extends Command<unknown> & Actored>(type: MessageType<C>): ProtectedUseCaseTarget<C>;
  command<C extends Command<unknown>>(type: MessageType<C>): UseCaseTarget<C>;

  /** Declares the one handler of a query: bound as a use case and registered on the `QueryBus`. */
  query<Q extends Query<unknown> & Actored>(type: MessageType<Q>): ProtectedUseCaseTarget<Q>;
  query<Q extends Query<unknown>>(type: MessageType<Q>): UseCaseTarget<Q>;

  /**
   * Declares the handler of an integration event, under a consumer name: subscribed to the
   * subscriber of the module when the application starts, unsubscribed when it stops. Each
   * event is handled inside the `ExecutionScope`, in a context of origin `event` that
   * continues its correlation, its idempotency mark and its work in one `UnitOfWork`.
   */
  on<Payload>(
    contract: EventContract<Payload>,
    options: ConsumerOptions,
  ): HandlerTarget<IntegrationEventHandler<Payload>>;

  /**
   * Declares a job run by time, under its name: bound as a singleton and registered on
   * the `JobScheduler`. `builder.job('billing.send-reminders', { every: '15m' }).handledBy(SendReminders, [CommandBus])`.
   */
  job(name: string, settings: ScheduledOptions): HandlerTarget<ScheduledJob>;

  /**
   * Adds classes that declare themselves with the decorators of `@ddd-ts-kit/kernel/declarations`:
   * a class, a list of them, or a namespace import of a barrel. `contextModule` is this call
   * alone; here it mixes with the explicit statements of one module.
   */
  include(declared: DeclaredSource): void;

  /**
   * Puts an aspect around every instance the application creates for a binding of one of the
   * kinds, whichever module declares the binding: outside the aspects of the binding itself
   * (`.with`), inside the `decorate` hook, the first one declared outermost. This is how
   * `kernelModule()` makes every repository dispatch domain events with its save.
   */
  around(kinds: readonly DependencyKind[], aspect: (resolve: Resolve) => BindingAspect): void;
}
