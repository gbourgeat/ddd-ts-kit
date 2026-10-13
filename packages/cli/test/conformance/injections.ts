import type { Injection } from './injection.js';
import { BEHAVIOUR_INJECTIONS } from './injections/behaviour-injections.js';
import { BOUNDARY_INJECTIONS } from './injections/boundary-injections.js';
import { CLEAN_INJECTIONS } from './injections/clean-injections.js';
import { ERROR_INJECTIONS } from './injections/error-injections.js';
import { EVENT_SOURCING_INJECTIONS } from './injections/event-sourcing-injections.js';
import { LIFECYCLE_INJECTIONS } from './injections/lifecycle-injections.js';
import { STRUCTURE_INJECTIONS } from './injections/structure-injections.js';
import { WIRING_INJECTIONS } from './injections/wiring-injections.js';

/** One violation per rule of the catalogue, in the order of its families. */
export const INJECTIONS: readonly Injection[] = [
  ...BOUNDARY_INJECTIONS,
  ...STRUCTURE_INJECTIONS,
  ...CLEAN_INJECTIONS,
  ...BEHAVIOUR_INJECTIONS,
  ...LIFECYCLE_INJECTIONS,
  ...ERROR_INJECTIONS,
  ...EVENT_SOURCING_INJECTIONS,
  ...WIRING_INJECTIONS,
];
