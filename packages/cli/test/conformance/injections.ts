import type { Injection } from './injection';
import { AUTHZ_AND_EVENT_INJECTIONS } from './injections/authz-and-event-injections';
import { BEHAVIOUR_INJECTIONS } from './injections/behaviour-injections';
import { BOUNDARY_INJECTIONS } from './injections/boundary-injections';
import { CLEAN_INJECTIONS } from './injections/clean-injections';
import { ERROR_INJECTIONS } from './injections/error-injections';
import { SCHEMA_INJECTIONS } from './injections/schema-injections';
import { EVENT_SOURCING_INJECTIONS } from './injections/event-sourcing-injections';
import { LIFECYCLE_INJECTIONS } from './injections/lifecycle-injections';
import { MODULE_INJECTIONS } from './injections/module-injections';
import { PERSISTENCE_INJECTIONS } from './injections/persistence-injections';
import { STRUCTURE_INJECTIONS } from './injections/structure-injections';
import { TEST_INJECTIONS } from './injections/test-injections';
import { VALUE_OBJECT_INJECTIONS } from './injections/value-object-injections';
import { WIRING_INJECTIONS } from './injections/wiring-injections';

/** One violation per rule of the catalogue, in the order of its families. */
export const INJECTIONS: readonly Injection[] = [
  ...BOUNDARY_INJECTIONS,
  ...STRUCTURE_INJECTIONS,
  ...MODULE_INJECTIONS,
  ...PERSISTENCE_INJECTIONS,
  ...CLEAN_INJECTIONS,
  ...BEHAVIOUR_INJECTIONS,
  ...VALUE_OBJECT_INJECTIONS,
  ...TEST_INJECTIONS,
  ...AUTHZ_AND_EVENT_INJECTIONS,
  ...LIFECYCLE_INJECTIONS,
  ...ERROR_INJECTIONS,
  ...SCHEMA_INJECTIONS,
  ...EVENT_SOURCING_INJECTIONS,
  ...WIRING_INJECTIONS,
];
