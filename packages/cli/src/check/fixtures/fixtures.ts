import { ALIAS_DECLARED_FIXTURES } from './alias-declared-fixtures';
import { BUSINESS_NAME_FIXTURES } from './business-name-fixtures';
import { AUTHZ_DECLARED_FIXTURES } from './authz-declared-fixtures';
import { AUTHZ_FIXTURES } from './authz-fixtures';
import { AUTHZ_GRANTED_FIXTURES } from './authz-granted-fixtures';
import { AUTHZ_POLICY_FIXTURES } from './authz-policy-fixtures';
import { AUTHZ_SCOPE_NARROWS_FIXTURES } from './authz-scope-narrows-fixtures';
import { CLEAN_FIXTURES } from './clean-fixtures';
import { COMPOSITION_FIXTURES } from './composition-fixtures';
import { CONFIG_FIXTURES } from './config-fixtures';
import { CONSTRUCTOR_INJECTION_FIXTURES } from './constructor-injection-fixtures';
import { CONSUMER_FIXTURES } from './consumer-fixtures';
import { CONTEXT_FIXTURES } from './context-fixtures';
import { BUDGET_FIXTURES } from './budget-fixtures';
import { COVERAGE_FIXTURES } from './coverage-fixtures';
import { MUTATION_FIXTURES } from './mutation-fixtures';
import { CONTEXT_FILE_FIXTURES } from './context-file-fixtures';
import { DECLARATIONS_FIXTURES } from './declarations-fixtures';
import { EARLIER_DECLARATIONS_FIXTURES } from './earlier-declarations-fixtures';
import { DOMAIN_EVENTS_FIXTURES } from './domain-events-fixtures';
import { ERRORS_FIXTURES } from './errors-fixtures';
import { EVENT_SOURCING_FIXTURES } from './event-sourcing-fixtures';
import { EVENTS_FIXTURES } from './events-fixtures';
import { EXTENSION_FIXTURES } from './extension-fixtures';
import { EXTRACTABLE_FIXTURES } from './extractable-fixtures';
import { FILES_FIXTURES } from './files-fixtures';
import { GOVERNANCE_FIXTURES } from './governance-fixtures';
import { IMPORTS_FIXTURES } from './imports-fixtures';
import { LANGUAGE_FIXTURES } from './language-fixtures';
import { VOCABULARY_FIXTURES } from './vocabulary-fixtures';
import { OTHER_LANGUAGE_FIXTURES } from './other-language-fixtures';
import { LAYER_FIXTURES } from './layer-fixtures';
import { LAYOUT_FIXTURES } from './layout-fixtures';
import { LIFECYCLE_FIXTURES } from './lifecycle-fixtures';
import { MODULE_FIXTURES } from './module-fixtures';
import { NAMED_REFUSAL_FIXTURES } from './named-refusal-fixtures';
import { NAMING_FIXTURES } from './naming-fixtures';
import { OUTBOX_FIXTURES } from './outbox-fixtures';
import { PERSISTENCE_FIXTURES } from './persistence-fixtures';
import { PORTS_FIXTURES } from './ports-fixtures';
import { PURITY_FIXTURES } from './purity-fixtures';
import { SCHEDULING_FIXTURES } from './scheduling-fixtures';
import { SCHEMA_FIXTURES } from './schema-fixtures';
import { STANDARD_FIXTURES } from './standard-fixtures';
import { PRIVACY_FIXTURES } from './privacy-fixtures';
import { TENANCY_FIXTURES } from './tenancy-fixtures';
import { TEST_FIXTURES } from './test-fixtures';
import { TRACING_FIXTURES } from './tracing-fixtures';
import { TREE_FIXTURES } from './tree-fixtures';
import { MODEL_FUNCTION_FIXTURES } from './model-function-fixtures';
import { VALUE_OBJECT_FILE_FIXTURES } from './value-object-file-fixtures';
import type { Fixture } from './fixture';

/**
 * Mini-projects proving each rule both ways. They ship with the CLI so that
 * `ddd-ts-kit check --self` can verify an installed build, and the test suite
 * replays the very same list.
 */
export const FIXTURES: readonly Fixture[] = [
  ...ALIAS_DECLARED_FIXTURES,
  ...AUTHZ_DECLARED_FIXTURES,
  ...AUTHZ_FIXTURES,
  ...AUTHZ_POLICY_FIXTURES,
  ...AUTHZ_GRANTED_FIXTURES,
  ...AUTHZ_SCOPE_NARROWS_FIXTURES,
  ...CLEAN_FIXTURES,
  ...COMPOSITION_FIXTURES,
  ...CONFIG_FIXTURES,
  ...CONSTRUCTOR_INJECTION_FIXTURES,
  ...CONSUMER_FIXTURES,
  ...CONTEXT_FIXTURES,
  ...COVERAGE_FIXTURES,
  ...BUDGET_FIXTURES,
  ...MUTATION_FIXTURES,
  ...CONTEXT_FILE_FIXTURES,
  ...DECLARATIONS_FIXTURES,
  ...EARLIER_DECLARATIONS_FIXTURES,
  ...DOMAIN_EVENTS_FIXTURES,
  ...ERRORS_FIXTURES,
  ...NAMED_REFUSAL_FIXTURES,
  ...SCHEMA_FIXTURES,
  ...EVENT_SOURCING_FIXTURES,
  ...EVENTS_FIXTURES,
  ...EXTENSION_FIXTURES,
  ...EXTRACTABLE_FIXTURES,
  ...FILES_FIXTURES,
  ...GOVERNANCE_FIXTURES,
  ...IMPORTS_FIXTURES,
  ...LANGUAGE_FIXTURES,
  ...VOCABULARY_FIXTURES,
  ...OTHER_LANGUAGE_FIXTURES,
  ...LAYER_FIXTURES,
  ...LAYOUT_FIXTURES,
  ...LIFECYCLE_FIXTURES,
  ...MODULE_FIXTURES,
  ...NAMING_FIXTURES,
  ...BUSINESS_NAME_FIXTURES,
  ...OUTBOX_FIXTURES,
  ...PERSISTENCE_FIXTURES,
  ...PORTS_FIXTURES,
  ...PURITY_FIXTURES,
  ...SCHEDULING_FIXTURES,
  ...STANDARD_FIXTURES,
  ...TENANCY_FIXTURES,
  ...PRIVACY_FIXTURES,
  ...TEST_FIXTURES,
  ...TRACING_FIXTURES,
  ...TREE_FIXTURES,
  ...VALUE_OBJECT_FILE_FIXTURES,
  ...MODEL_FUNCTION_FIXTURES,
];
