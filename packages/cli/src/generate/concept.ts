import { parseConceptName, type Name } from '../naming/index.js';
import type { ConceptRole } from './concept-role.js';
import type { Scope } from './scope.js';
import { spokenInLanguage } from './spoken-in-language.js';

/**
 * The name of a concept of the model: normalized, free of technical words, and spoken in the
 * ubiquitous language of the context. The terms given with `--term` join the glossary first.
 */
export function concept(scope: Scope, input: string, role: ConceptRole): Name {
  const name = parseConceptName(input, role.what, { allowName: scope.flags.allowName, strip: role.strip ?? [] });

  spokenInLanguage(scope, name);

  return name;
}
