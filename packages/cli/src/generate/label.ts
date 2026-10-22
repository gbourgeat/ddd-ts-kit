import { parseConceptName, type Name } from '../naming';
import type { ConceptRole } from './concept-role';
import type { Scope } from './scope';

/** A name that is not a concept of the model (a port, an outside system): only its form is checked. */
export function label(scope: Scope, input: string, role: ConceptRole): Name {
  return parseConceptName(input, role.what, { allowName: scope.flags.allowName, strip: role.strip ?? [] });
}
