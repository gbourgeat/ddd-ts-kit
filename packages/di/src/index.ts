// tsyringe 4.10 throws while loading when the Reflect metadata polyfill is absent, even
// though this package never uses decorators. Importing it here, before tsyringe, spares
// consumers a line they would otherwise have to remember in every entry point and test.
import 'reflect-metadata';

export { describeToken, tokenIdentity, type Token } from '@ddd-ts-kit/kernel/declarations';
export { WiringError, type WiringErrorCode } from './errors/wiring-error.js';
export type { DependencyKind } from '@ddd-ts-kit/kernel';
export type {
  BindingAspect,
  BindingAspectInfo,
  DependencyList,
  DependencyTokens,
  EventContract,
  IntegrationEventHandler,
  MessageHandler,
  PermissionRef,
  ResourcePointer,
} from '@ddd-ts-kit/kernel/declarations';
export type { BindingOptions } from './module/binding-options.js';
export type { BindingTarget } from './module/binding-target.js';
export type { ContextModule } from './module/context-module.js';
export { defineContextModule } from './module/define-context-module.js';
export type { HandlerTarget } from './module/handler-target.js';
export type { ModuleBuilder } from './module/module-builder.js';
export type { ModuleContext } from './module/module-context.js';
export type { ProtectedUseCaseTarget } from './module/protected-use-case-target.js';
export type { UseCaseTarget } from './module/use-case-target.js';
export type { ValueBindingOptions } from './module/value-binding-options.js';
export type { BindingSource } from './wiring/binding-source.js';
export type { Declarer } from './wiring/declarer.js';
export type { Lifetime } from './wiring/lifetime.js';
export type { PolicyBinding } from './wiring/policy-binding.js';
export type { Resolve } from './wiring/resolve.js';
export { contextModule } from './declared/context-module.js';
export type { DeclaredSource } from './declared/declared-source.js';
export type { ConsumerOptions } from './consumer/consumer-options.js';
export type { ConsumerRuntime } from './consumer/consumer-runtime.js';
export { UnreadableEventError } from './consumer/unreadable-event-error.js';
export type { JobsOptions } from './jobs/jobs-options.js';
export type { ApplicationOptions } from './application/application-options.js';
export type { Application } from './application/application.js';
export type { BindingInfo } from './application/binding-info.js';
export { createApplication } from './application/create-application.js';
export type { Decorate } from './application/decorate.js';
export { overrideForTests } from './application/override-for-tests.js';
export { override, type Override } from './application/override.js';
export type {
  AppliedEventDescription,
  BindingDescription,
  DomainEventHandlerDescription,
  HandlerDescription,
  IntegrationEventHandlerDescription,
  OriginDescription,
  PolicyDescription,
  ProjectionDescription,
  ScheduledJobDescription,
  WiringDescription,
} from './description/wiring-description.js';
export type { AuthorizationMode } from './authorization/authorization-mode.js';
export { DeclaredPolicies } from './authorization/declared-policies.js';
export type { RequirementOptions } from './authorization/requirement-options.js';
export type { UseCaseAccess } from './authorization/use-case-access.js';
export type { UseCaseDeclaration } from './authorization/use-case-declaration.js';
export { UseCaseDeclarations } from './authorization/use-case-declarations.js';
export { UseCaseGuard } from './authorization/use-case-guard.js';
export { Instrumentation, type InstrumentedConsumer, type InstrumentedJob } from './kernel/instrumentation.js';
export type { KernelModuleOptions } from './kernel/kernel-module-options.js';
export { kernelModule } from './kernel/kernel-module.js';
export type { Provided } from './kernel/provided.js';
export { createTestApplication } from './testing/create-test-application.js';
export { fake } from './testing/fake.js';
export type { TestApplicationOptions } from './testing/test-application-options.js';
export type { TestApplication } from './testing/test-application.js';
export type { TestJobs } from './testing/test-jobs.js';
export type { TestKernel } from './testing/test-kernel.js';
