import { docsOf, type DddRule } from '../support/rule/docs-of';
import { applicationCommandQuerySeparation } from './application-command-query-separation';
import { applicationHandlerShape } from './application-handler-shape';
import { aspectsOutsideIn } from './aspects-outside-in';
import { authzActorExplicit } from './authz-actor-explicit';
import { authzDeclared } from './authz-declared';
import { authzFieldsBySchema } from './authz-fields-by-schema';
import { authzInApplication } from './authz-in-application';
import { cleanFileSize } from './clean-file-size';
import { cleanFunctionCeiling } from './clean-function-ceiling';
import { cleanFunctionSize } from './clean-function-size';
import { cleanNoCommentedOutCode } from './clean-no-commented-out-code';
import { cleanNoEscapeHatch } from './clean-no-escape-hatch';
import { cleanNoFlagArgument } from './clean-no-flag-argument';
import { cleanNoHashPrivate } from './clean-no-hash-private';
import { cleanNoNoiseComment } from './clean-no-noise-comment';
import { cleanOneExportPerFile } from './clean-one-export-per-file';
import { cleanStepdown } from './clean-stepdown';
import { contextExtractable } from './context-extractable';
import {
  contextDeclaredRelationship,
  contextPublishedLanguageIsAContract,
  contextPublishedLanguageOnly,
} from './context-boundaries';
import { declarationsConstructorInjection } from './declarations-constructor-injection';
import { declarationsRoleDeclared } from './declarations-role-declared';
import { domainAggregateEncapsulation } from './domain-aggregate-encapsulation';
import { domainEventsDispatchedOnSave } from './domain-events-dispatched-on-save';
import { domainEventsTransactionalBeforeCommit } from './domain-events-transactional-before-commit';
import { domainNoGenericError } from './domain-no-generic-error';
import { eventSourcingPastTense } from './event-sourcing-past-tense';
import { eventSourcingProjectionNeverAppends } from './event-sourcing-projection-never-appends';
import { eventSourcingStateInApply } from './event-sourcing-state-in-apply';
import { eventSourcingStoreBehindRepository } from './event-sourcing-store-behind-repository';
import { eventSourcingUpcasterRequired } from './event-sourcing-upcaster-required';
import { errorsConstructorNotPublic } from './errors-constructor-not-public';
import { errorsFactoryName } from './errors-factory-name';
import { errorsThroughFactory } from './errors-through-factory';
import { domainValueObjectClass } from './domain-value-object-class';
import { domainValueObjectImmutability } from './domain-value-object-immutability';
import { eventsConsumerIdempotent } from './events-consumer-idempotent';
import { eventsNameFormat } from './events-name-format';
import { eventsOutboxRequired } from './events-outbox-required';
import { governanceRecordedDeviation } from './governance-recorded-deviation';
import { importsAliasOnly } from './imports-alias-only';
import { importsExtension } from './imports-extension';
import { layerApplicationInward } from './layer-application-inward';
import { layerDomainPurity } from './layer-domain-purity';
import { layerInfrastructureNoPresentation, layerPresentationNoInfrastructure } from './layer-sideways';
import { portsAbstractClass } from './ports-abstract-class';
import { portsImplementsNeverExtends } from './ports-implements-never-extends';
import { portsNoConcreteDependency } from './ports-no-concrete-dependency';
import { portsNoTokenConstant } from './ports-no-token-constant';
import { portsValueImport } from './ports-value-import';
import { presentationControllerDelegates } from './presentation-controller-delegates';
import { presentationControllerShape } from './presentation-controller-shape';
import { presentationGuardAtTheEdge } from './presentation-guard-at-the-edge';
import { presentationSharedCacheVaries } from './presentation-shared-cache-varies';
import { purityNoAmbientRandomness, purityNoEnvironment, purityNoSystemClock } from './purity';
import { lifecycleStatusThroughMachine } from './lifecycle-status-through-machine';
import { namingBusinessName } from './naming-business-name';
import { processSendsCommandsOnly } from './process-sends-commands-only';
import { schedulingJobName } from './scheduling-job-name';
import { schedulingJobTriggersUseCase } from './scheduling-job-triggers-use-case';
import { schemaPresentationOnly } from './schema-presentation-only';
import { standardNoParallelInterface } from './standard-no-parallel-interface';
import { testNoMocks } from './test-no-mocks';
import { cleanNoMagicNumber } from './clean-no-magic-number';
import { languageDeclaredVocabulary } from './language-declared-vocabulary';
import { tracingPlatformOnly } from './tracing-platform-only';

const ALL = [
  layerDomainPurity,
  layerApplicationInward,
  layerPresentationNoInfrastructure,
  layerInfrastructureNoPresentation,
  contextPublishedLanguageOnly,
  contextDeclaredRelationship,
  contextPublishedLanguageIsAContract,
  languageDeclaredVocabulary,
  namingBusinessName,
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
  domainValueObjectClass,
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
  authzFieldsBySchema,
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
  lifecycleStatusThroughMachine,
  processSendsCommandsOnly,
  schedulingJobName,
  schemaPresentationOnly,
  importsAliasOnly,
  importsExtension,
  presentationControllerShape,
  presentationControllerDelegates,
  presentationGuardAtTheEdge,
  presentationSharedCacheVaries,
];

/** Keyed by ESLint name: the id of docs/ARCHITECTURE.md with its slash replaced by a dash, or the name of a companion rule. */
export const rules: Readonly<Record<string, DddRule>> = Object.fromEntries(
  ALL.map((rule) => [docsOf(rule).name, rule]),
);
