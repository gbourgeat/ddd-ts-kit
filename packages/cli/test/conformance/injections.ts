import type { Injection } from './injection.js';
import { AUTHZ_AND_EVENT_INJECTIONS } from './injections/authz-and-event-injections.js';
import { BEHAVIOUR_INJECTIONS } from './injections/behaviour-injections.js';
import { BOUNDARY_INJECTIONS } from './injections/boundary-injections.js';
import { CLEAN_INJECTIONS } from './injections/clean-injections.js';
import { ERROR_INJECTIONS } from './injections/error-injections.js';
import { SCHEMA_INJECTIONS } from './injections/schema-injections.js';
import { EVENT_SOURCING_INJECTIONS } from './injections/event-sourcing-injections.js';
import { LIFECYCLE_INJECTIONS } from './injections/lifecycle-injections.js';
import { MODULE_INJECTIONS } from './injections/module-injections.js';
import { PERSISTENCE_INJECTIONS } from './injections/persistence-injections.js';
import { STRUCTURE_INJECTIONS } from './injections/structure-injections.js';
import { VALUE_OBJECT_INJECTIONS } from './injections/value-object-injections.js';
import { WIRING_INJECTIONS } from './injections/wiring-injections.js';

/** One violation per rule of the catalogue, in the order of its families. */
export const INJECTIONS: readonly Injection[] = [
  ...BOUNDARY_INJECTIONS,
  ...STRUCTURE_INJECTIONS,
  ...MODULE_INJECTIONS,
  ...PERSISTENCE_INJECTIONS,
  ...CLEAN_INJECTIONS,
  ...BEHAVIOUR_INJECTIONS,
  ...VALUE_OBJECT_INJECTIONS,
  ...AUTHZ_AND_EVENT_INJECTIONS,
  ...LIFECYCLE_INJECTIONS,
  ...ERROR_INJECTIONS,
  ...SCHEMA_INJECTIONS,
  ...EVENT_SOURCING_INJECTIONS,
  ...WIRING_INJECTIONS,
];
