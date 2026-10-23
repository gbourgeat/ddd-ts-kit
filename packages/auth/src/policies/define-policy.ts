import { AuthorizationSetupError } from '../errors/authorization-setup-error';
import type { Policy } from './policy';

const POLICY_NAME_PATTERN = /^[a-z][a-z0-9]*([.-][a-z0-9]+)*$/;

/** Lives in `application/authorization/<name>.policy.ts`, with a spec of its own. */
export function definePolicy<Subject>(policy: Policy<Subject>): Policy<Subject> {
  if (!POLICY_NAME_PATTERN.test(policy.name)) {
    throw new AuthorizationSetupError(
      `"${policy.name}" is not a valid policy name: lower-case words separated by dots or dashes, as it becomes a reason code.`,
    );
  }

  return Object.freeze({ ...policy });
}
