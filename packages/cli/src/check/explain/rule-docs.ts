import type { RuleDoc } from '../model/rule-doc';
import { AUTHZ_DOCS } from './authz-docs';
import { CLEAN_DOCS } from './clean-docs';
import { CONTEXT_DOCS } from './context-docs';
import { DOMAIN_DOCS } from './domain-docs';
import { ERRORS_DOCS } from './errors-docs';
import { EVENT_SOURCING_DOCS } from './event-sourcing-docs';
import { EVENTS_DOCS } from './events-docs';
import { IMPORTS_DOCS } from './imports-docs';
import { LANGUAGE_DOCS } from './language-docs';
import { LAYER_DOCS } from './layer-docs';
import { LAYOUT_DOCS } from './layout-docs';
import { LIFECYCLE_DOCS } from './lifecycle-docs';
import { MODULE_DOCS } from './module-docs';
import { PERSISTENCE_DOCS } from './persistence-docs';
import { PORTS_DOCS } from './ports-docs';
import { SCHEDULING_DOCS } from './scheduling-docs';
import { SCHEMA_DOCS } from './schema-docs';
import { STANDARD_DOCS } from './standard-docs';
import { TENANCY_DOCS } from './tenancy-docs';
import { TREE_DOCS } from './tree-docs';
import { WIRING_DOCS } from './wiring-docs';
import { PRIVACY_DOCS } from './privacy-docs';

/** Shown by `ddd-ts-kit explain <rule-id>`: the reason behind the rule and one example each way. */
export const RULE_DOCS: Readonly<Record<string, RuleDoc>> = {
  ...AUTHZ_DOCS,
  ...PRIVACY_DOCS,
  ...CLEAN_DOCS,
  ...CONTEXT_DOCS,
  ...DOMAIN_DOCS,
  ...ERRORS_DOCS,
  ...EVENT_SOURCING_DOCS,
  ...EVENTS_DOCS,
  ...IMPORTS_DOCS,
  ...LANGUAGE_DOCS,
  ...LAYER_DOCS,
  ...LAYOUT_DOCS,
  ...LIFECYCLE_DOCS,
  ...MODULE_DOCS,
  ...PERSISTENCE_DOCS,
  ...PORTS_DOCS,
  ...SCHEDULING_DOCS,
  ...SCHEMA_DOCS,
  ...STANDARD_DOCS,
  ...TENANCY_DOCS,
  ...TREE_DOCS,
  ...WIRING_DOCS,
};
