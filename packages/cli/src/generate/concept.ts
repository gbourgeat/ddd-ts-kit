import { parseGlossary } from '../check/language/parse-glossary.js';
import { TECHNICAL_WORDS } from '../check/language/technical-words.js';
import { unknownWords } from '../check/language/unknown-words.js';
import { CliError } from '../cli-error.js';
import { parseConceptName, splitWords, toName, type Name } from '../naming/index.js';
import type { ConceptRole } from './concept-role.js';
import type { Scope } from './scope.js';

/**
 * The name of a concept of the model: normalized, free of technical words, and spoken in the
 * ubiquitous language of the context. The terms given with `--term` join the glossary first.
 */
export function concept(scope: Scope, input: string, role: ConceptRole): Name {
  const name = parseConceptName(input, role.what, { allowName: scope.flags.allowName, strip: role.strip ?? [] });

  if (!scope.flags.allowName) {
    refuseTechnicalWords(name);
    refuseUnknownWords(scope, name);
  }

  return name;
}

function refuseTechnicalWords(name: Name): void {
  const technical = splitWords(name.pascal).filter((word) => TECHNICAL_WORDS.includes(word));

  if (technical.length === 0) return;

  throw new CliError(
    `"${name.pascal}" carries the technical word "${technical.join('", "')}".`,
    'Use the noun or verb a domain expert uses for it (rule language/no-technical-name), or pass --allow-name if this really is the business term.',
  );
}

function refuseUnknownWords(scope: Scope, name: Name): void {
  const file = `${scope.dir}/CONTEXT.md`;
  const glossary = parseGlossary(scope.ws.read(file) ?? '');
  const unknown = unknownWords(name.pascal, glossary);

  if (unknown.length === 0) return;

  const known = glossary.terms.length > 0 ? `use an existing term (${glossary.terms.join(', ')})` : 'define the ubiquitous language first';
  const flags = unknown.map((word) => `--term "${toName(word).pascal}=<what it means for the business>"`).join(' ');

  throw new CliError(
    `"${name.pascal}" uses ${unknown.map((word) => `"${word}"`).join(', ')}, which the glossary of ${file} does not define.`,
    `Either ${known}, or add the term in the same command: ${flags}. The glossary is written before the code (rule language/glossary-term).`,
  );
}
