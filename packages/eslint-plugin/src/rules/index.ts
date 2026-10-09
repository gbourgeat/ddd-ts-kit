import { docsOf, eslintName, type DddRule } from '../support/define-rule.js';
import { applicationCommandQuerySeparation } from './application-command-query-separation.js';
import { applicationHandlerShape } from './application-handler-shape.js';
import { aspectsOutsideIn } from './aspects-outside-in.js';
import { authzActorExplicit } from './authz-actor-explicit.js';
import { authzDeclared } from './authz-declared.js';
import { authzInApplication } from './authz-in-application.js';
import { cleanFunctionSize } from './clean-function-size.js';
import { cleanNoCommentedOutCode } from './clean-no-commented-out-code.js';
import { cleanNoEscapeHatch } from './clean-no-escape-hatch.js';
import { cleanNoFlagArgument } from './clean-no-flag-argument.js';
import { cleanNoNoiseComment } from './clean-no-noise-comment.js';
import { cleanStepdown } from './clean-stepdown.js';
import { contextExtractable } from './context-extractable.js';
import { contextDeclaredRelationship, contextPublishedLanguageIsAContract, contextPublishedLanguageOnly } from './context-boundaries.js';
import { domainAggregateEncapsulation } from './domain-aggregate-encapsulation.js';
import { domainNoGenericError } from './domain-no-generic-error.js';
import { domainValueObjectImmutability } from './domain-value-object-immutability.js';
import { eventsConsumerIdempotent } from './events-consumer-idempotent.js';
import { eventsNameFormat } from './events-name-format.js';
import { eventsOutboxRequired } from './events-outbox-required.js';
import { governanceRecordedDeviation } from './governance-recorded-deviation.js';
import { layerApplicationInward } from './layer-application-inward.js';
import { layerDomainPurity } from './layer-domain-purity.js';
import { layerInfrastructureNoPresentation, layerPresentationNoInfrastructure } from './layer-sideways.js';
import { purityNoAmbientRandomness, purityNoEnvironment, purityNoSystemClock } from './purity.js';
import { standardNoParallelInterface } from './standard-no-parallel-interface.js';
import { testNoMocks } from './test-no-mocks.js';

const ALL = [
  layerDomainPurity,
  layerApplicationInward,
  layerPresentationNoInfrastructure,
  layerInfrastructureNoPresentation,
  contextPublishedLanguageOnly,
  contextDeclaredRelationship,
  contextPublishedLanguageIsAContract,
  purityNoSystemClock,
  purityNoAmbientRandomness,
  purityNoEnvironment,
  cleanStepdown,
  cleanFunctionSize,
  cleanNoFlagArgument,
  cleanNoCommentedOutCode,
  cleanNoNoiseComment,
  cleanNoEscapeHatch,
  domainAggregateEncapsulation,
  domainValueObjectImmutability,
  domainNoGenericError,
  applicationHandlerShape,
  applicationCommandQuerySeparation,
  testNoMocks,
  eventsNameFormat,
  eventsOutboxRequired,
  eventsConsumerIdempotent,
  contextExtractable,
  authzDeclared,
  authzInApplication,
  authzActorExplicit,
  aspectsOutsideIn,
  standardNoParallelInterface,
  governanceRecordedDeviation,
];

/** Keyed by ESLint name: the id of docs/ARCHITECTURE.md with its slash replaced by a dash. */
export const rules: Readonly<Record<string, DddRule>> = Object.fromEntries(ALL.map((rule) => [eslintName(docsOf(rule).ruleId), rule]));
