import { docsOf, type DddRule } from '../support/rule/docs-of.js';
import { applicationCommandQuerySeparation } from './application-command-query-separation.js';
import { applicationHandlerShape } from './application-handler-shape.js';
import { aspectsOutsideIn } from './aspects-outside-in.js';
import { authzActorExplicit } from './authz-actor-explicit.js';
import { authzDeclared } from './authz-declared.js';
import { authzInApplication } from './authz-in-application.js';
import { cleanFileSize } from './clean-file-size.js';
import { cleanFunctionCeiling } from './clean-function-ceiling.js';
import { cleanFunctionSize } from './clean-function-size.js';
import { cleanNoCommentedOutCode } from './clean-no-commented-out-code.js';
import { cleanNoEscapeHatch } from './clean-no-escape-hatch.js';
import { cleanNoFlagArgument } from './clean-no-flag-argument.js';
import { cleanNoHashPrivate } from './clean-no-hash-private.js';
import { cleanNoNoiseComment } from './clean-no-noise-comment.js';
import { cleanOneExportPerFile } from './clean-one-export-per-file.js';
import { cleanStepdown } from './clean-stepdown.js';
import { contextExtractable } from './context-extractable.js';
import {
  contextDeclaredRelationship,
  contextPublishedLanguageIsAContract,
  contextPublishedLanguageOnly,
} from './context-boundaries.js';
import { declarationsConstructorInjection } from './declarations-constructor-injection.js';
import { declarationsRoleDeclared } from './declarations-role-declared.js';
import { domainAggregateEncapsulation } from './domain-aggregate-encapsulation.js';
import { domainEventsDispatchedOnSave } from './domain-events-dispatched-on-save.js';
import { domainEventsTransactionalBeforeCommit } from './domain-events-transactional-before-commit.js';
import { domainNoGenericError } from './domain-no-generic-error.js';
import { eventSourcingPastTense } from './event-sourcing-past-tense.js';
import { eventSourcingProjectionNeverAppends } from './event-sourcing-projection-never-appends.js';
import { eventSourcingStateInApply } from './event-sourcing-state-in-apply.js';
import { eventSourcingStoreBehindRepository } from './event-sourcing-store-behind-repository.js';
import { eventSourcingUpcasterRequired } from './event-sourcing-upcaster-required.js';
import { errorsConstructorNotPublic } from './errors-constructor-not-public.js';
import { errorsFactoryName } from './errors-factory-name.js';
import { errorsThroughFactory } from './errors-through-factory.js';
import { domainValueObjectImmutability } from './domain-value-object-immutability.js';
import { eventsConsumerIdempotent } from './events-consumer-idempotent.js';
import { eventsNameFormat } from './events-name-format.js';
import { eventsOutboxRequired } from './events-outbox-required.js';
import { governanceRecordedDeviation } from './governance-recorded-deviation.js';
import { importsAliasOnly } from './imports-alias-only.js';
import { importsExtension } from './imports-extension.js';
import { layerApplicationInward } from './layer-application-inward.js';
import { layerDomainPurity } from './layer-domain-purity.js';
import { layerInfrastructureNoPresentation, layerPresentationNoInfrastructure } from './layer-sideways.js';
import { portsAbstractClass } from './ports-abstract-class.js';
import { portsImplementsNeverExtends } from './ports-implements-never-extends.js';
import { portsNoConcreteDependency } from './ports-no-concrete-dependency.js';
import { portsNoTokenConstant } from './ports-no-token-constant.js';
import { portsValueImport } from './ports-value-import.js';
import { presentationControllerDelegates } from './presentation-controller-delegates.js';
import { presentationControllerShape } from './presentation-controller-shape.js';
import { presentationGuardAtTheEdge } from './presentation-guard-at-the-edge.js';
import { purityNoAmbientRandomness, purityNoEnvironment, purityNoSystemClock } from './purity.js';
import { schedulingJobName } from './scheduling-job-name.js';
import { schedulingJobTriggersUseCase } from './scheduling-job-triggers-use-case.js';
import { schemaPresentationOnly } from './schema-presentation-only.js';
import { standardNoParallelInterface } from './standard-no-parallel-interface.js';
import { testNoMocks } from './test-no-mocks.js';
import { cleanNoMagicNumber } from './clean-no-magic-number.js';
import { languageDeclaredVocabulary } from './language-declared-vocabulary.js';
import { tracingPlatformOnly } from './tracing-platform-only.js';

const ALL = [
  layerDomainPurity,
  layerApplicationInward,
  layerPresentationNoInfrastructure,
  layerInfrastructureNoPresentation,
  contextPublishedLanguageOnly,
  contextDeclaredRelationship,
  contextPublishedLanguageIsAContract,
  languageDeclaredVocabulary,
  purityNoSystemClock,
  purityNoAmbientRandomness,
  purityNoEnvironment,
  cleanStepdown,
  cleanFunctionSize,
  cleanFunctionCeiling,
  cleanNoFlagArgument,
  cleanNoCommentedOutCode,
  cleanNoNoiseComment,
  cleanNoEscapeHatch,
  cleanNoHashPrivate,
  cleanOneExportPerFile,
  cleanFileSize,
  cleanNoMagicNumber,
  domainAggregateEncapsulation,
  domainValueObjectImmutability,
  domainNoGenericError,
  errorsThroughFactory,
  errorsConstructorNotPublic,
  errorsFactoryName,
  applicationHandlerShape,
  applicationCommandQuerySeparation,
  domainEventsDispatchedOnSave,
  domainEventsTransactionalBeforeCommit,
  eventSourcingStateInApply,
  eventSourcingPastTense,
  eventSourcingStoreBehindRepository,
  eventSourcingProjectionNeverAppends,
  eventSourcingUpcasterRequired,
  testNoMocks,
  eventsNameFormat,
  eventsOutboxRequired,
  eventsConsumerIdempotent,
  contextExtractable,
  authzDeclared,
  authzInApplication,
  authzActorExplicit,
  aspectsOutsideIn,
  tracingPlatformOnly,
  standardNoParallelInterface,
  governanceRecordedDeviation,
  declarationsRoleDeclared,
  declarationsConstructorInjection,
  portsAbstractClass,
  portsImplementsNeverExtends,
  portsNoTokenConstant,
  portsNoConcreteDependency,
  portsValueImport,
  schedulingJobTriggersUseCase,
  schedulingJobName,
  schemaPresentationOnly,
  importsAliasOnly,
  importsExtension,
  presentationControllerShape,
  presentationControllerDelegates,
  presentationGuardAtTheEdge,
];

/** Keyed by ESLint name: the id of docs/ARCHITECTURE.md with its slash replaced by a dash, or the name of a companion rule. */
export const rules: Readonly<Record<string, DddRule>> = Object.fromEntries(
  ALL.map((rule) => [docsOf(rule).name, rule]),
);
