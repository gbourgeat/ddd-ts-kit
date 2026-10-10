// tsyringe 4.10 throws while loading when the Reflect metadata polyfill is absent, even
// though this package never uses decorators. Importing it here, before tsyringe, spares
// consumers a line they would otherwise have to remember in every entry point and test.
import 'reflect-metadata';
import type { IntegrationEventHandler } from './consumer.js';

export { token, describeToken, type Token } from './token.js';
export { WiringError, type WiringErrorCode } from './errors.js';
export {
  defineContextModule,
  type BindingAspect,
  type BindingAspectInfo,
  type BindingOptions,
  type BindingSource,
  type BindingTarget,
  type ContextModule,
  type DependencyKind,
  type DependencyList,
  type DependencyTokens,
  type HandlerTarget,
  type Lifetime,
  type MessageHandler,
  type ModuleBuilder,
  type ModuleContext,
  type ProtectedUseCaseTarget,
  type Resolve,
  type UseCaseTarget,
  type ValueBindingOptions,
} from './module.js';
export { contextModule } from './context-module.js';
export type { DeclaredSource } from './declared.js';
export type { Declarer, PolicyBinding } from './wiring.js';
export {
  UnreadableEventError,
  type ConsumerOptions,
  type ConsumerRuntime,
  type EventContract,
  type IntegrationEventHandler,
} from './consumer.js';
export type { JobsOptions } from './jobs.js';
export {
  createApplication,
  override,
  overrideForTests,
  type Application,
  type ApplicationOptions,
  type BindingInfo,
  type Decorate,
  type Override,
} from './application.js';
export type {
  BindingDescription,
  DomainEventHandlerDescription,
  HandlerDescription,
  IntegrationEventHandlerDescription,
  ScheduledJobDescription,
  OriginDescription,
  PolicyDescription,
  WiringDescription,
} from './description.js';
export {
  ACTOR_CONTEXT,
  CACHE,
  CLOCK,
  COMMAND_BUS,
  DOMAIN_EVENTS,
  EVENT_BUS,
  EVENT_PUBLISHER,
  EVENT_SUBSCRIBER,
  EXECUTION_SCOPE,
  ID_GENERATOR,
  JOB_SCHEDULER,
  LOCK,
  LOGGER,
  METRICS,
  PROCESSED_EVENTS,
  QUERY_BUS,
  RATE_LIMITER,
  UNIT_OF_WORK,
} from './kernel-tokens.js';
export {
  DECLARED_POLICIES,
  USE_CASE_DECLARATIONS,
  USE_CASE_GUARD,
  type AuthorizationMode,
} from './authorization.js';
export type {
  PermissionRef,
  RequirementOptions,
  ResourcePointer,
  UseCaseAccess,
  UseCaseDeclaration,
} from './use-case-access.js';
export { kernelModule, type KernelModuleOptions, type Provided } from './kernel-module.js';
export {
  createTestApplication,
  fake,
  type TestApplication,
  type TestApplicationOptions,
  type TestJobs,
  type TestKernel,
} from './testing.js';

/** @deprecated Renamed `IntegrationEventHandler`, as in `@ddd-ts-kit/kernel/declarations`. */
export type IntegrationEventHandlerInstance<Payload> = IntegrationEventHandler<Payload>;
