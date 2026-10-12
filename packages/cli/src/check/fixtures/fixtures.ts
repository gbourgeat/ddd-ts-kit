import { ALIAS_DECLARED_FIXTURES } from './alias-declared-fixtures.js';
import { AUTHZ_DECLARED_FIXTURES } from './authz-declared-fixtures.js';
import { AUTHZ_FIXTURES } from './authz-fixtures.js';
import { CLEAN_FIXTURES } from './clean-fixtures.js';
import { COMPOSITION_FIXTURES } from './composition-fixtures.js';
import { CONFIG_FIXTURES } from './config-fixtures.js';
import { CONSTRUCTOR_INJECTION_FIXTURES } from './constructor-injection-fixtures.js';
import { CONSUMER_FIXTURES } from './consumer-fixtures.js';
import { CONTEXT_FIXTURES } from './context-fixtures.js';
import { COVERAGE_FIXTURES } from './coverage-fixtures.js';
import { DECLARATIONS_FIXTURES } from './declarations-fixtures.js';
import { DOMAIN_EVENTS_FIXTURES } from './domain-events-fixtures.js';
import { ERRORS_FIXTURES } from './errors-fixtures.js';
import { EVENTS_FIXTURES } from './events-fixtures.js';
import { EXTENSION_FIXTURES } from './extension-fixtures.js';
import { EXTRACTABLE_FIXTURES } from './extractable-fixtures.js';
import { FILES_FIXTURES } from './files-fixtures.js';
import { GOVERNANCE_FIXTURES } from './governance-fixtures.js';
import { IMPORTS_FIXTURES } from './imports-fixtures.js';
import { LANGUAGE_FIXTURES } from './language-fixtures.js';
import { LAYER_FIXTURES } from './layer-fixtures.js';
import { LAYOUT_FIXTURES } from './layout-fixtures.js';
import { NAMING_FIXTURES } from './naming-fixtures.js';
import { OUTBOX_FIXTURES } from './outbox-fixtures.js';
import { PERSISTENCE_FIXTURES } from './persistence-fixtures.js';
import { PORTS_FIXTURES } from './ports-fixtures.js';
import { PURITY_FIXTURES } from './purity-fixtures.js';
import { SCHEDULING_FIXTURES } from './scheduling-fixtures.js';
import { STANDARD_FIXTURES } from './standard-fixtures.js';
import { TEST_FIXTURES } from './test-fixtures.js';
import { TRACING_FIXTURES } from './tracing-fixtures.js';
import { TREE_FIXTURES } from './tree-fixtures.js';
import type { Fixture } from './fixture.js';

/**
 * Mini-projects proving each rule both ways. They ship with the CLI so that
 * `ddd-ts-kit check --self` can verify an installed build, and the test suite
 * replays the very same list.
 */
export const FIXTURES: readonly Fixture[] = [
  ...ALIAS_DECLARED_FIXTURES,
  ...AUTHZ_DECLARED_FIXTURES,
  ...AUTHZ_FIXTURES,
  ...CLEAN_FIXTURES,
  ...COMPOSITION_FIXTURES,
  ...CONFIG_FIXTURES,
  ...CONSTRUCTOR_INJECTION_FIXTURES,
  ...CONSUMER_FIXTURES,
  ...CONTEXT_FIXTURES,
  ...COVERAGE_FIXTURES,
  ...DECLARATIONS_FIXTURES,
  ...DOMAIN_EVENTS_FIXTURES,
  ...ERRORS_FIXTURES,
  ...EVENTS_FIXTURES,
  ...EXTENSION_FIXTURES,
  ...EXTRACTABLE_FIXTURES,
  ...FILES_FIXTURES,
  ...GOVERNANCE_FIXTURES,
  ...IMPORTS_FIXTURES,
  ...LANGUAGE_FIXTURES,
  ...LAYER_FIXTURES,
  ...LAYOUT_FIXTURES,
  ...NAMING_FIXTURES,
  ...OUTBOX_FIXTURES,
  ...PERSISTENCE_FIXTURES,
  ...PORTS_FIXTURES,
  ...PURITY_FIXTURES,
  ...SCHEDULING_FIXTURES,
  ...STANDARD_FIXTURES,
  ...TEST_FIXTURES,
  ...TRACING_FIXTURES,
  ...TREE_FIXTURES,
];
