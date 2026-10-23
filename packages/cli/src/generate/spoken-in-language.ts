import { parseGlossary } from '../check/language/parse-glossary';
import { TECHNICAL_WORDS } from '../check/language/technical-words';
import { unknownWords } from '../check/language/unknown-words';
import { CliError } from '../cli-error';
import { splitWords, toName, type Name } from '../naming';
import type { Scope } from './scope';

/**
 * Refuses a name that carries a technical word, or a word the glossary of the context does not
 * define, the `qualifiers` aside (those of a refusal: `InvalidAppointment`, `BookingTooLate`).
 * `--allow-name` lets any name through.
 */
export function spokenInLanguage(scope: Scope, name: Name, qualifiers: readonly string[] = []): void {
  if (scope.flags.allowName) {
    return;
  }

  refuseTechnicalWords(name);
  refuseUnknownWords(scope, name, qualifiers);
}

function refuseTechnicalWords(name: Name): void {
  const technical = splitWords(name.pascal).filter((word) => TECHNICAL_WORDS.includes(word));

  if (technical.length === 0) {
    return;
  }

  throw new CliError(
    `"${name.pascal}" carries the technical word "${technical.join('", "')}".`,
    'Use the noun or verb a domain expert uses for it (rule language/no-technical-name), or pass --allow-name if this really is the business term.',
  );
}

function refuseUnknownWords(scope: Scope, name: Name, qualifiers: readonly string[]): void {
  const file = `${scope.dir}/CONTEXT.md`;
  const glossary = parseGlossary(scope.ws.read(file) ?? '');
  const unknown = unknownWords(name.pascal, glossary, qualifiers);

  if (unknown.length === 0) {
    return;
  }

  const terms =
    glossary.terms.length > 0
      ? `use an existing term (${glossary.terms.join(', ')})`
      : 'define the ubiquitous language first';

  const known = qualifiers.length > 0 ? `${terms} or a qualifier of a refusal (${qualifiers.join(', ')})` : terms;

  const flags = unknown.map((word) => `--term "${toName(word).pascal}=<what it means for the business>"`).join(' ');

  throw new CliError(
    `"${name.pascal}" uses ${unknown.map((word) => `"${word}"`).join(', ')}, which the glossary of ${file} does not define.`,
    `Either ${known}, or add the term in the same command: ${flags}. The glossary is written before the code (rule language/glossary-term).`,
  );
}
