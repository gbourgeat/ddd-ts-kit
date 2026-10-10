import type { Rule } from '../model/rule.js';
import { aspectsOutsideIn } from '../rules/aspects-outside-in.js';
import { authzActorExplicit } from '../rules/authz-actor-explicit.js';
import { authzDeclared } from '../rules/authz-declared.js';
import { authzInApplication } from '../rules/authz-in-application.js';
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
import { contextDeclaredRelationship } from '../rules/context-declared-relationship.js';
import { contextExtractable } from '../rules/context-extractable.js';
import { contextNoCycle } from '../rules/context-no-cycle.js';
import { contextPublishedLanguageIsAContract } from '../rules/context-published-language-is-a-contract.js';
import { contextPublishedLanguageOnly } from '../rules/context-published-language-only.js';
import { declarationsBarrelCurrent } from '../rules/declarations-barrel-current.js';
import { declarationsRoleDeclared } from '../rules/declarations-role-declared.js';
import { domainEventsDispatchedOnSave } from '../rules/domain-events-dispatched-on-save.js';
import { domainEventsTransactionalBeforeCommit } from '../rules/domain-events-transactional-before-commit.js';
import { eventsConsumerIdempotent } from '../rules/events-consumer-idempotent.js';
import { eventsDefinedInPublishedLanguage } from '../rules/events-defined-in-published-language.js';
import { eventsNameFormat } from '../rules/events-name-format.js';
import { eventsOutboxRequired } from '../rules/events-outbox-required.js';
import { governanceRecordedDeviation } from '../rules/governance-recorded-deviation.js';
import { importsAliasDeclared } from '../rules/imports-alias-declared.js';
import { importsAliasOnly } from '../rules/imports-alias-only.js';
import { languageGlossaryTerm } from '../rules/language-glossary-term.js';
import { languageNoTechnicalName } from '../rules/language-no-technical-name.js';
import { layerApplicationInward } from '../rules/layer-application-inward.js';
import { layerDomainPurity } from '../rules/layer-domain-purity.js';
import { layerInfrastructureNoPresentation } from '../rules/layer-infrastructure-no-presentation.js';
import { layerPresentationNoInfrastructure } from '../rules/layer-presentation-no-infrastructure.js';
import { namingOneConceptPerFile } from '../rules/naming-one-concept-per-file.js';
import { namingSearchNotList } from '../rules/naming-search-not-list.js';
import { namingSuffix } from '../rules/naming-suffix.js';
import { portsAbstractClass } from '../rules/ports-abstract-class.js';
import { portsImplementsNeverExtends } from '../rules/ports-implements-never-extends.js';
import { portsNoConcreteDependency } from '../rules/ports-no-concrete-dependency.js';
import { portsNoTokenConstant } from '../rules/ports-no-token-constant.js';
import { portsValueImport } from '../rules/ports-value-import.js';
import { purityNoAmbientRandomness } from '../rules/purity-no-ambient-randomness.js';
import { purityNoEnvironment } from '../rules/purity-no-environment.js';
import { purityNoSystemClock } from '../rules/purity-no-system-clock.js';
import { schedulingJobName } from '../rules/scheduling-job-name.js';
import { schedulingJobTriggersUseCase } from '../rules/scheduling-job-triggers-use-case.js';
import { standardNoParallelInterface } from '../rules/standard-no-parallel-interface.js';
import { testBuilderRequired } from '../rules/test-builder-required.js';
import { testNoMocks } from '../rules/test-no-mocks.js';
import { testSpecRequired } from '../rules/test-spec-required.js';
import { tracingPlatformOnly } from '../rules/tracing-platform-only.js';
import { treeClosed } from '../rules/tree-closed.js';
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
  namingSuffix,
  namingOneConceptPerFile,
  namingSearchNotList,
  testSpecRequired,
  eventsNameFormat,
  eventsDefinedInPublishedLanguage,
  testNoMocks,
  testBuilderRequired,
  languageGlossaryTerm,
  languageNoTechnicalName,
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
  eventsOutboxRequired,
  eventsConsumerIdempotent,
  domainEventsDispatchedOnSave,
  domainEventsTransactionalBeforeCommit,
  contextExtractable,
  authzDeclared,
  authzInApplication,
  authzActorExplicit,
  aspectsOutsideIn,
  tracingPlatformOnly,
  standardNoParallelInterface,
  governanceRecordedDeviation,
  compositionOnlyInModule,
  declarationsRoleDeclared,
  declarationsBarrelCurrent,
  portsAbstractClass,
  portsImplementsNeverExtends,
  portsNoTokenConstant,
  portsNoConcreteDependency,
  portsValueImport,
  schedulingJobTriggersUseCase,
  schedulingJobName,
  importsAliasOnly,
  importsAliasDeclared,
];
