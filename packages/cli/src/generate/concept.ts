import { parseConceptName, type Name } from '../naming';
import type { ConceptRole } from './concept-role';
import type { Scope } from './scope';
import { spokenInLanguage } from './spoken-in-language';

/**
 * The name of a concept of the model: normalized, free of technical words, and spoken in the
 * ubiquitous language of the context. The terms given with `--term` join the glossary first.
 */
export function concept(scope: Scope, input: string, role: ConceptRole): Name {
  const name = parseConceptName(input, role.what, { allowName: scope.flags.allowName, strip: role.strip ?? [] });

  spokenInLanguage(scope, name);

  return name;
}
