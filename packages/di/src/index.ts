// tsyringe 4.10 throws while loading when the Reflect metadata polyfill is absent, even
// though this package never uses decorators. Importing it here, before tsyringe, spares
// consumers a line they would otherwise have to remember in every entry point and test.
import 'reflect-metadata';

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
export {
  UnreadableEventError,
  type ConsumerOptions,
  type EventConsumer,
  type EventContract,
} from './consumer.js';
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
  HandlerDescription,
  SubscriptionDescription,
  WiringDescription,
} from './description.js';
export {
  CACHE,
  CLOCK,
  COMMAND_BUS,
  EVENT_BUS,
  EVENT_PUBLISHER,
  EVENT_SUBSCRIBER,
  EXECUTION_SCOPE,
  ID_GENERATOR,
  LOGGER,
  METRICS,
  PROCESSED_EVENTS,
  QUERY_BUS,
  UNIT_OF_WORK,
} from './kernel-tokens.js';
export {
  ACTOR_CONTEXT,
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
  type TestKernel,
} from './testing.js';
