import { parseConceptName, type Name } from '../naming';
import type { ConceptRole } from './concept-role';
import type { Scope } from './scope';
import { spokenInLanguage } from './spoken-in-language';

/**
 * The name of a concept of the model: normalized, free of technical words no term of the glossary
 * holds, and spoken in the ubiquitous language of the context. The terms given with `--term` join the glossary first.
 */
export function concept(scope: Scope, input: string, role: ConceptRole): Name {
  const name = parseConceptName(input, role.what, { strip: role.strip ?? [] });

  const alongside = (role.alongside ?? []).map(({ words, what, label }) => ({
    name: parseConceptName(words, what),
    label,
  }));

  spokenInLanguage(scope, { name, alongside });

  return name;
}
