import type { Rule } from '../model/rule';
import { aspectsOutsideIn } from '../rules/aspects-outside-in';
import { authzActorExplicit } from '../rules/authz-actor-explicit';
import { authzFieldsBySchema } from '../rules/authz-fields-by-schema';
import { authzDeclared } from '../rules/authz-declared';
import { authzGranted } from '../rules/authz-granted';
import { authzResourceModelled } from '../rules/authz-resource-modelled';
import { authzSystemActorGranted } from '../rules/authz-system-actor-granted';
import { authzScopeNarrows } from '../rules/authz-scope-narrows';
import { privacyDeclaredField } from '../rules/privacy-declared-field';
import { privacyErasureReachesCopies } from '../rules/privacy-erasure-reaches-copies';
import { privacyEventPayloadDeclared } from '../rules/privacy-event-payload-declared';
import { privacyNoPersonalDataInLogs } from '../rules/privacy-no-personal-data-in-logs';
import { privacySnapshotSealed } from '../rules/privacy-snapshot-sealed';
import { privacySubjectIsOpaque } from '../rules/privacy-subject-is-opaque';
import { authzInApplication } from '../rules/authz-in-application';
import { authzPolicyAsked } from '../rules/authz-policy-asked';
import { cleanBlankLines } from '../rules/clean-blank-lines';
import { cleanBraces } from '../rules/clean-braces';
import { cleanFileSize } from '../rules/clean-file-size';
import { cleanFunctionSize } from '../rules/clean-function-size';
import { cleanNoCommentedOutCode } from '../rules/clean-no-commented-out-code';
import { cleanNoEscapeHatch } from '../rules/clean-no-escape-hatch';
import { cleanNoFlagArgument } from '../rules/clean-no-flag-argument';
import { cleanNoHashPrivate } from '../rules/clean-no-hash-private';
import { cleanNoNoiseComment } from '../rules/clean-no-noise-comment';
import { cleanOneExportPerFile } from '../rules/clean-one-export-per-file';
import { cleanStepdown } from '../rules/clean-stepdown';
import { compositionOnlyInModule } from '../rules/composition-only-in-module';
import { configRuleOffEverywhere } from '../rules/config-rule-off-everywhere';
import { contextDeclaredRelationship } from '../rules/context-declared-relationship';
import { contextExtractable } from '../rules/context-extractable';
import { contextNoCycle } from '../rules/context-no-cycle';
import { moduleComplete } from '../rules/module-complete';
import { moduleDeclared } from '../rules/module-declared';
import { moduleNoCycle } from '../rules/module-no-cycle';
import { contextPublishedLanguageIsAContract } from '../rules/context-published-language-is-a-contract';
import { contextPublishedLanguageOnly } from '../rules/context-published-language-only';
import { declarationsBarrelCurrent } from '../rules/declarations-barrel-current';
import { declarationsConstructorInjection } from '../rules/declarations-constructor-injection';
import { declarationsPortAdapterWired } from '../rules/declarations-port-adapter-wired';
import { declarationsRoleDeclared } from '../rules/declarations-role-declared';
import { domainEventsDispatchedOnSave } from '../rules/domain-events-dispatched-on-save';
import { domainEventsTransactionalBeforeCommit } from '../rules/domain-events-transactional-before-commit';
import { domainValueObjectClass } from '../rules/domain-value-object-class';
import { errorsCodeListed } from '../rules/errors-code-listed';
import { errorsCodeUnique } from '../rules/errors-code-unique';
import { eventSourcingPastTense } from '../rules/event-sourcing-past-tense';
import { eventSourcingProjectionNeverAppends } from '../rules/event-sourcing-projection-never-appends';
import { eventSourcingStateInApply } from '../rules/event-sourcing-state-in-apply';
import { eventSourcingStoreBehindRepository } from '../rules/event-sourcing-store-behind-repository';
import { eventSourcingUpcasterRequired } from '../rules/event-sourcing-upcaster-required';
import { errorsKnownCode } from '../rules/errors-known-code';
import { filesPortNotConnector } from '../rules/files-port-not-connector';
import { eventsConsumerIdempotent } from '../rules/events-consumer-idempotent';
import { eventsDefinedInPublishedLanguage } from '../rules/events-defined-in-published-language';
import { eventsNameDeclaredOnce } from '../rules/events-name-declared-once';
import { eventsNameFormat } from '../rules/events-name-format';
import { eventsOutboxRequired } from '../rules/events-outbox-required';
import { governanceRecordedDeviation } from '../rules/governance-recorded-deviation';
import { importsAliasDeclared } from '../rules/imports-alias-declared';
import { importsAliasOnly } from '../rules/imports-alias-only';
import { importsExtension } from '../rules/imports-extension';
import { languageDeclaredVocabulary } from '../rules/language-declared-vocabulary';
import { languageGlossaryTerm } from '../rules/language-glossary-term';
import { languageNoTechnicalName } from '../rules/language-no-technical-name';
import { layerApplicationInward } from '../rules/layer-application-inward';
import { lifecycleStatusThroughMachine } from '../rules/lifecycle-status-through-machine';
import { layerDomainPurity } from '../rules/layer-domain-purity';
import { layerInfrastructureNoPresentation } from '../rules/layer-infrastructure-no-presentation';
import { layerPresentationNoInfrastructure } from '../rules/layer-presentation-no-infrastructure';
import { namingBusinessName } from '../rules/naming-business-name';
import { namingOneConceptPerFile } from '../rules/naming-one-concept-per-file';
import { namingSearchNotList } from '../rules/naming-search-not-list';
import { namingSuffix } from '../rules/naming-suffix';
import { nestControllersCurrent } from '../rules/nest-controllers-current';
import { nestNoParallelPipeline } from '../rules/nest-no-parallel-pipeline';
import { persistenceMigrationHistory } from '../rules/persistence-migration-history';
import { persistenceNoFileContent } from '../rules/persistence-no-file-content';
import { persistencePrimaryKeyOrder } from '../rules/persistence-primary-key-order';
import { portsAbstractClass } from '../rules/ports-abstract-class';
import { portsImplementsNeverExtends } from '../rules/ports-implements-never-extends';
import { portsNoConcreteDependency } from '../rules/ports-no-concrete-dependency';
import { portsNoTokenConstant } from '../rules/ports-no-token-constant';
import { portsValueImport } from '../rules/ports-value-import';
import { processSendsCommandsOnly } from '../rules/process-sends-commands-only';
import { purityNoAmbientRandomness } from '../rules/purity-no-ambient-randomness';
import { purityNoEnvironment } from '../rules/purity-no-environment';
import { purityNoSystemClock } from '../rules/purity-no-system-clock';
import { schedulingTenancyDeclared } from '../rules/scheduling-tenancy-declared';
import { schedulingJobName } from '../rules/scheduling-job-name';
import { schedulingJobRegistered } from '../rules/scheduling-job-registered';
import { schedulingJobTriggersUseCase } from '../rules/scheduling-job-triggers-use-case';
import { schemaNoDuplicateShape } from '../rules/schema-no-duplicate-shape';
import { schemaPresentationOnly } from '../rules/schema-presentation-only';
import { standardNoParallelInterface } from '../rules/standard-no-parallel-interface';
import { tenancyScopedStatement } from '../rules/tenancy-scoped-statement';
import { testAcceptanceBlackBox } from '../rules/test-acceptance-black-box';
import { testBuilderRequired } from '../rules/test-builder-required';
import { testHelperPlaced } from '../rules/test-helper-placed';
import { testCoverageGoverned } from '../rules/test-coverage-governed';
import { testMutationGoverned } from '../rules/test-mutation-governed';
import { testNoMocks } from '../rules/test-no-mocks';
import { testSpecRequired } from '../rules/test-spec-required';
import { tracingPlatformOnly } from '../rules/tracing-platform-only';
import { treeClosed } from '../rules/tree-closed';
import { treeDocumentedPaths } from '../rules/tree-documented-paths';
import { treeContextDoc } from '../rules/tree-context-doc';

/** The rules of docs/ARCHITECTURE.md section 3 this checker holds, `config/valid` aside: it needs their ids. */
export const ARCHITECTURE_RULES: readonly Rule[] = [
  layerDomainPurity,
  layerApplicationInward,
  layerPresentationNoInfrastructure,
  layerInfrastructureNoPresentation,
  contextPublishedLanguageOnly,
  contextDeclaredRelationship,
  contextPublishedLanguageIsAContract,
  contextNoCycle,
  moduleDeclared,
  moduleComplete,
  moduleNoCycle,
  treeClosed,
  treeContextDoc,
  treeDocumentedPaths,
  namingSuffix,
  namingOneConceptPerFile,
  namingSearchNotList,
  namingBusinessName,
  schemaPresentationOnly,
  schemaNoDuplicateShape,
  testSpecRequired,
  eventsNameFormat,
  eventsNameDeclaredOnce,
  eventsDefinedInPublishedLanguage,
  testNoMocks,
  testBuilderRequired,
  testAcceptanceBlackBox,
  testHelperPlaced,
  testCoverageGoverned,
  testMutationGoverned,
  languageGlossaryTerm,
  languageNoTechnicalName,
  languageDeclaredVocabulary,
  purityNoSystemClock,
  purityNoAmbientRandomness,
  purityNoEnvironment,
  cleanStepdown,
  cleanFunctionSize,
  cleanNoCommentedOutCode,
  cleanNoNoiseComment,
  cleanNoEscapeHatch,
  cleanNoFlagArgument,
  cleanNoHashPrivate,
  cleanBlankLines,
  cleanBraces,
  cleanOneExportPerFile,
  cleanFileSize,
  domainValueObjectClass,
  eventsOutboxRequired,
  eventsConsumerIdempotent,
  domainEventsDispatchedOnSave,
  domainEventsTransactionalBeforeCommit,
  eventSourcingStateInApply,
  eventSourcingPastTense,
  eventSourcingStoreBehindRepository,
  eventSourcingProjectionNeverAppends,
  eventSourcingUpcasterRequired,
  contextExtractable,
  authzDeclared,
  authzInApplication,
  authzActorExplicit,
  authzFieldsBySchema,
  authzPolicyAsked,
  authzGranted,
  authzScopeNarrows,
  authzResourceModelled,
  authzSystemActorGranted,
  privacyDeclaredField,
  privacyEventPayloadDeclared,
  privacyErasureReachesCopies,
  privacySubjectIsOpaque,
  privacyNoPersonalDataInLogs,
  privacySnapshotSealed,
  aspectsOutsideIn,
  tracingPlatformOnly,
  tenancyScopedStatement,
  standardNoParallelInterface,
  nestNoParallelPipeline,
  nestControllersCurrent,
  governanceRecordedDeviation,
  configRuleOffEverywhere,
  compositionOnlyInModule,
  declarationsRoleDeclared,
  declarationsBarrelCurrent,
  declarationsConstructorInjection,
  declarationsPortAdapterWired,
  portsAbstractClass,
  portsImplementsNeverExtends,
  portsNoTokenConstant,
  portsNoConcreteDependency,
  portsValueImport,
  schedulingJobTriggersUseCase,
  lifecycleStatusThroughMachine,
  processSendsCommandsOnly,
  schedulingJobName,
  schedulingJobRegistered,
  schedulingTenancyDeclared,
  importsAliasOnly,
  importsExtension,
  importsAliasDeclared,
  errorsCodeUnique,
  errorsCodeListed,
  errorsKnownCode,
  persistenceMigrationHistory,
  persistenceNoFileContent,
  persistencePrimaryKeyOrder,
  filesPortNotConnector,
];
