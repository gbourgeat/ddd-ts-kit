// tsyringe 4.10 throws while loading when the Reflect metadata polyfill is absent, even
// though this package never uses decorators. Importing it here, before tsyringe, spares
// consumers a line they would otherwise have to remember in every entry point and test.
import 'reflect-metadata';

export { describeToken, tokenIdentity, type Token } from '@ddd-ts-kit/kernel/declarations';
export { WiringError, type WiringErrorCode } from './errors/wiring-error';
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
export type { BindingOptions } from './module/binding-options';
export type { BindingTarget } from './module/binding-target';
export type { ContextModule } from './module/context-module';
export { defineContextModule } from './module/define-context-module';
export type { HandlerTarget } from './module/handler-target';
export type { BackgroundJobTarget, PayloadDeclared } from './module/background-job-target';
export type { ModuleBuilder } from './module/module-builder';
export type { ModuleContext } from './module/module-context';
export type { ProtectedUseCaseTarget } from './module/protected-use-case-target';
export type { UseCaseTarget } from './module/use-case-target';
export type { ValueBindingOptions } from './module/value-binding-options';
export type { BindingSource } from './wiring/binding-source';
export type { Declarer } from './wiring/declarer';
export type { EdgeBinding } from './wiring/edge-binding';
export type { Lifetime } from './wiring/lifetime';
export type { PolicyBinding } from './wiring/policy-binding';
export type { Resolve } from './wiring/resolve';
export { contextModule } from './declared/context-module';
export { DeclaredEdges } from './declared/declared-edges';
export type { DeclaredSource } from './declared/declared-source';
export { declaredTokens } from './declared/declared-tokens';
export type { ConsumerOptions } from './consumer/consumer-options';
export type { ConsumerRuntime } from './consumer/consumer-runtime';
export { UnreadableEventError } from './consumer/unreadable-event-error';
export type { JobsOptions } from './jobs/jobs-options';
export type { ApplicationOptions } from './application/application-options';
export type { Application } from './application/application';
export type { BindingInfo } from './application/binding-info';
export { createApplication } from './application/create-application';
export type { Decorate } from './application/decorate';
export { overrideForTests } from './application/override-for-tests';
export { override, type Override } from './application/override';
export type {
  AppliedEventDescription,
  BackgroundJobDescription,
  BindingDescription,
  DomainEventHandlerDescription,
  HandlerDescription,
  IntegrationEventHandlerDescription,
  OriginDescription,
  PolicyDescription,
  ProjectionDescription,
  ScheduledJobDescription,
  WiringDescription,
} from './description/wiring-description';
export type { AuthorizationMode } from './authorization/authorization-mode';
export { DeclaredPolicies } from './authorization/declared-policies';
export type { RequirementOptions } from './authorization/requirement-options';
export type { UseCaseAccess } from './authorization/use-case-access';
export type { UseCaseDeclaration } from './authorization/use-case-declaration';
export { UseCaseDeclarations } from './authorization/use-case-declarations';
export { UseCaseGuard } from './authorization/use-case-guard';
export { Instrumentation, type InstrumentedConsumer, type InstrumentedJob } from './kernel/instrumentation';
export type { KernelModuleOptions } from './kernel/kernel-module-options';
export { kernelModule } from './kernel/kernel-module';
export type { Provided } from './kernel/provided';
export { createTestApplication } from './testing/create-test-application';
export { fake } from './testing/fake';
export type { TestApplicationOptions } from './testing/test-application-options';
export type { TestApplication } from './testing/test-application';
export type { TestBackgroundJobs } from './testing/test-background-jobs';
export type { TestJobs } from './testing/test-jobs';
export type { TestKernel } from './testing/test-kernel';
