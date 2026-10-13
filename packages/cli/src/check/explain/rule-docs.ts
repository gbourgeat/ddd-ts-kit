import type { RuleDoc } from '../model/rule-doc.js';
import { AUTHZ_DOCS } from './authz-docs.js';
import { CLEAN_DOCS } from './clean-docs.js';
import { CONTEXT_DOCS } from './context-docs.js';
import { ERRORS_DOCS } from './errors-docs.js';
import { EVENT_SOURCING_DOCS } from './event-sourcing-docs.js';
import { EVENTS_DOCS } from './events-docs.js';
import { IMPORTS_DOCS } from './imports-docs.js';
import { LANGUAGE_DOCS } from './language-docs.js';
import { LAYER_DOCS } from './layer-docs.js';
import { LAYOUT_DOCS } from './layout-docs.js';
import { LIFECYCLE_DOCS } from './lifecycle-docs.js';
import { PERSISTENCE_DOCS } from './persistence-docs.js';
import { PORTS_DOCS } from './ports-docs.js';
import { SCHEDULING_DOCS } from './scheduling-docs.js';
import { SCHEMA_DOCS } from './schema-docs.js';
import { STANDARD_DOCS } from './standard-docs.js';
import { TENANCY_DOCS } from './tenancy-docs.js';
import { TREE_DOCS } from './tree-docs.js';
import { WIRING_DOCS } from './wiring-docs.js';

/** Shown by `ddd-ts-kit explain <rule-id>`: the reason behind the rule and one example each way. */
export const RULE_DOCS: Readonly<Record<string, RuleDoc>> = {
  ...AUTHZ_DOCS,
  ...CLEAN_DOCS,
  ...CONTEXT_DOCS,
  ...ERRORS_DOCS,
  ...EVENT_SOURCING_DOCS,
  ...EVENTS_DOCS,
  ...IMPORTS_DOCS,
  ...LANGUAGE_DOCS,
  ...LAYER_DOCS,
  ...LAYOUT_DOCS,
  ...LIFECYCLE_DOCS,
  ...PERSISTENCE_DOCS,
  ...PORTS_DOCS,
  ...SCHEDULING_DOCS,
  ...SCHEMA_DOCS,
  ...STANDARD_DOCS,
  ...TENANCY_DOCS,
  ...TREE_DOCS,
  ...WIRING_DOCS,
};
