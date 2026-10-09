import type { Rule } from '../types.js';
import { cleanFunctionSize } from './clean-function-size.js';
import { cleanNoCommentedOutCode } from './clean-no-commented-out-code.js';
import { cleanNoEscapeHatch } from './clean-no-escape-hatch.js';
import { cleanNoFlagArgument } from './clean-no-flag-argument.js';
import { cleanNoNoiseComment } from './clean-no-noise-comment.js';
import { cleanStepdown } from './clean-stepdown.js';
import { compositionOnlyInModule } from './composition-only-in-module.js';
import { createConfigValid } from './config-valid.js';
import { contextDeclaredRelationship } from './context-declared-relationship.js';
import { contextNoCycle } from './context-no-cycle.js';
import { contextPublishedLanguageIsAContract } from './context-published-language-is-a-contract.js';
import { contextPublishedLanguageOnly } from './context-published-language-only.js';
import { eventsDefinedInPublishedLanguage } from './events-defined-in-published-language.js';
import { eventsNameFormat } from './events-name-format.js';
import { languageGlossaryTerm } from './language-glossary-term.js';
import { languageNoTechnicalName } from './language-no-technical-name.js';
import { layerApplicationInward } from './layer-application-inward.js';
import { layerDomainPurity } from './layer-domain-purity.js';
import { layerInfrastructureNoPresentation } from './layer-infrastructure-no-presentation.js';
import { layerPresentationNoInfrastructure } from './layer-presentation-no-infrastructure.js';
import { namingOneConceptPerFile } from './naming-one-concept-per-file.js';
import { namingSuffix } from './naming-suffix.js';
import { purityNoAmbientRandomness } from './purity-no-ambient-randomness.js';
import { purityNoEnvironment } from './purity-no-environment.js';
import { purityNoSystemClock } from './purity-no-system-clock.js';
import { testBuilderRequired } from './test-builder-required.js';
import { testNoMocks } from './test-no-mocks.js';
import { testSpecRequired } from './test-spec-required.js';
import { treeClosed } from './tree-closed.js';
import { treeContextDoc } from './tree-context-doc.js';
import { SUPPRESSION_RULE_ID } from '../suppressions.js';

const architectureRules: readonly Rule[] = [
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
  compositionOnlyInModule,
];

/** The suppression check is run by the engine (it needs every directive), but is listed like a rule. */
export const SUPPRESSION_RULE = {
  id: SUPPRESSION_RULE_ID,
  description: 'An inline suppression names its rule and gives a reason after `--`.',
} as const;

/**
 * Rules of the architecture reference that need a syntax tree: `@ddd-ts-kit/eslint-plugin`
 * holds them, this checker only knows their ids so that the config may set their severity.
 */
export const ESLINT_ONLY_RULES: readonly { readonly id: string; readonly description: string }[] = [
  { id: 'domain/aggregate-encapsulation', description: 'An aggregate or entity has a private or protected constructor, no public mutable property and no setter.' },
  { id: 'domain/value-object-immutability', description: 'A value object has only readonly properties and never assigns to itself outside its constructor.' },
  { id: 'domain/no-generic-error', description: 'domain/ and application/ never `throw new Error(...)`: a business failure is a DomainError subclass.' },
  { id: 'application/handler-shape', description: 'A *.handler.ts file exports one class with a single public method, execute.' },
  { id: 'application/command-query-separation', description: 'A query handler never saves, deletes or publishes.' },
];

export const ESLINT_AUTHORITY = 'checked by @ddd-ts-kit/eslint-plugin';

export const RULE_IDS: readonly string[] = [...architectureRules.map((rule) => rule.id), 'config/valid', SUPPRESSION_RULE.id];

/** The rules that judge a source on its own, whatever the project around it (`check --clean-only`). */
export const CLEAN_RULE_IDS: readonly string[] = [cleanStepdown, cleanFunctionSize, cleanNoCommentedOutCode, cleanNoNoiseComment, cleanNoEscapeHatch].map((rule) => rule.id);

/** Every id the config may name under `rules`: the ones checked here and the ones ESLint holds. */
export const KNOWN_RULE_IDS: readonly string[] = [...RULE_IDS, ...ESLINT_ONLY_RULES.map((rule) => rule.id)];

export const RULES: readonly Rule[] = [...architectureRules, createConfigValid(() => KNOWN_RULE_IDS)];
