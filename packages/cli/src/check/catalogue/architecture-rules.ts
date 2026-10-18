import type { Rule } from '../model/rule.js';
import { aspectsOutsideIn } from '../rules/aspects-outside-in.js';
import { authzActorExplicit } from '../rules/authz-actor-explicit.js';
import { authzFieldsBySchema } from '../rules/authz-fields-by-schema.js';
import { authzDeclared } from '../rules/authz-declared.js';
import { authzGranted } from '../rules/authz-granted.js';
import { authzInApplication } from '../rules/authz-in-application.js';
import { authzPolicyAsked } from '../rules/authz-policy-asked.js';
import { cleanBlankLines } from '../rules/clean-blank-lines.js';
import { cleanBraces } from '../rules/clean-braces.js';
import { cleanFileSize } from '../rules/clean-file-size.js';
import { cleanFunctionSize } from '../rules/clean-function-size.js';
import { cleanNoCommentedOutCode } from '../rules/clean-no-commented-out-code.js';
import { cleanNoEscapeHatch } from '../rules/clean-no-escape-hatch.js';
import { cleanNoFlagArgument } from '../rules/clean-no-flag-argument.js';
import { cleanNoHashPrivate } from '../rules/clean-no-hash-private.js';
import { cleanNoNoiseComment } from '../rules/clean-no-noise-comment.js';
import { cleanOneExportPerFile } from '../rules/clean-one-export-per-file.js';
import { cleanStepdown } from '../rules/clean-stepdown.js';
import { compositionOnlyInModule } from '../rules/composition-only-in-module.js';
import { configRuleOffEverywhere } from '../rules/config-rule-off-everywhere.js';
import { contextDeclaredRelationship } from '../rules/context-declared-relationship.js';
import { contextExtractable } from '../rules/context-extractable.js';
import { contextNoCycle } from '../rules/context-no-cycle.js';
import { contextPublishedLanguageIsAContract } from '../rules/context-published-language-is-a-contract.js';
import { contextPublishedLanguageOnly } from '../rules/context-published-language-only.js';
import { declarationsBarrelCurrent } from '../rules/declarations-barrel-current.js';
import { declarationsConstructorInjection } from '../rules/declarations-constructor-injection.js';
import { declarationsRoleDeclared } from '../rules/declarations-role-declared.js';
import { domainEventsDispatchedOnSave } from '../rules/domain-events-dispatched-on-save.js';
import { domainEventsTransactionalBeforeCommit } from '../rules/domain-events-transactional-before-commit.js';
import { domainValueObjectClass } from '../rules/domain-value-object-class.js';
import { errorsCodeUnique } from '../rules/errors-code-unique.js';
import { eventSourcingPastTense } from '../rules/event-sourcing-past-tense.js';
import { eventSourcingProjectionNeverAppends } from '../rules/event-sourcing-projection-never-appends.js';
import { eventSourcingStateInApply } from '../rules/event-sourcing-state-in-apply.js';
import { eventSourcingStoreBehindRepository } from '../rules/event-sourcing-store-behind-repository.js';
import { eventSourcingUpcasterRequired } from '../rules/event-sourcing-upcaster-required.js';
import { errorsKnownCode } from '../rules/errors-known-code.js';
import { filesPortNotConnector } from '../rules/files-port-not-connector.js';
import { eventsConsumerIdempotent } from '../rules/events-consumer-idempotent.js';
import { eventsDefinedInPublishedLanguage } from '../rules/events-defined-in-published-language.js';
import { eventsNameDeclaredOnce } from '../rules/events-name-declared-once.js';
import { eventsNameFormat } from '../rules/events-name-format.js';
import { eventsOutboxRequired } from '../rules/events-outbox-required.js';
import { governanceRecordedDeviation } from '../rules/governance-recorded-deviation.js';
import { importsAliasDeclared } from '../rules/imports-alias-declared.js';
import { importsAliasOnly } from '../rules/imports-alias-only.js';
import { importsExtension } from '../rules/imports-extension.js';
import { languageDeclaredVocabulary } from '../rules/language-declared-vocabulary.js';
import { languageGlossaryTerm } from '../rules/language-glossary-term.js';
import { languageNoTechnicalName } from '../rules/language-no-technical-name.js';
import { layerApplicationInward } from '../rules/layer-application-inward.js';
import { lifecycleStatusThroughMachine } from '../rules/lifecycle-status-through-machine.js';
import { layerDomainPurity } from '../rules/layer-domain-purity.js';
import { layerInfrastructureNoPresentation } from '../rules/layer-infrastructure-no-presentation.js';
import { layerPresentationNoInfrastructure } from '../rules/layer-presentation-no-infrastructure.js';
import { namingBusinessName } from '../rules/naming-business-name.js';
import { namingOneConceptPerFile } from '../rules/naming-one-concept-per-file.js';
import { namingSearchNotList } from '../rules/naming-search-not-list.js';
import { namingSuffix } from '../rules/naming-suffix.js';
import { persistenceMigrationHistory } from '../rules/persistence-migration-history.js';
import { persistenceNoFileContent } from '../rules/persistence-no-file-content.js';
import { portsAbstractClass } from '../rules/ports-abstract-class.js';
import { portsImplementsNeverExtends } from '../rules/ports-implements-never-extends.js';
import { portsNoConcreteDependency } from '../rules/ports-no-concrete-dependency.js';
import { portsNoTokenConstant } from '../rules/ports-no-token-constant.js';
import { portsValueImport } from '../rules/ports-value-import.js';
import { processSendsCommandsOnly } from '../rules/process-sends-commands-only.js';
import { purityNoAmbientRandomness } from '../rules/purity-no-ambient-randomness.js';
import { purityNoEnvironment } from '../rules/purity-no-environment.js';
import { purityNoSystemClock } from '../rules/purity-no-system-clock.js';
import { schedulingJobName } from '../rules/scheduling-job-name.js';
import { schedulingJobTriggersUseCase } from '../rules/scheduling-job-triggers-use-case.js';
import { schemaNoDuplicateShape } from '../rules/schema-no-duplicate-shape.js';
import { schemaPresentationOnly } from '../rules/schema-presentation-only.js';
import { standardNoParallelInterface } from '../rules/standard-no-parallel-interface.js';
import { tenancyScopedStatement } from '../rules/tenancy-scoped-statement.js';
import { testAcceptanceBlackBox } from '../rules/test-acceptance-black-box.js';
import { testBuilderRequired } from '../rules/test-builder-required.js';
import { testHelperPlaced } from '../rules/test-helper-placed.js';
import { testCoverageGoverned } from '../rules/test-coverage-governed.js';
import { testNoMocks } from '../rules/test-no-mocks.js';
import { testSpecRequired } from '../rules/test-spec-required.js';
import { tracingPlatformOnly } from '../rules/tracing-platform-only.js';
import { treeClosed } from '../rules/tree-closed.js';
import { treeDocumentedPaths } from '../rules/tree-documented-paths.js';
import { treeContextDoc } from '../rules/tree-context-doc.js';

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
  aspectsOutsideIn,
  tracingPlatformOnly,
  tenancyScopedStatement,
  standardNoParallelInterface,
  governanceRecordedDeviation,
  configRuleOffEverywhere,
  compositionOnlyInModule,
  declarationsRoleDeclared,
  declarationsBarrelCurrent,
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
  importsAliasOnly,
  importsExtension,
  importsAliasDeclared,
  errorsCodeUnique,
  errorsKnownCode,
  persistenceMigrationHistory,
  persistenceNoFileContent,
  filesPortNotConnector,
];
