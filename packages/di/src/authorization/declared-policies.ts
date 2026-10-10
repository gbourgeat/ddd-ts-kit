import type { PolicyBinding } from '../wiring/policy-binding.js';

/**
 * The policy classes the contexts declared with `@Policy`, each resolved by its class. An
 * authorization module evaluates them next to the policies it was given.
 */
export abstract class DeclaredPolicies {
  static readonly tokenKey = 'di.DeclaredPolicies';

  abstract readonly list: readonly PolicyBinding[];
}
