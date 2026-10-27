import type { Glossary } from '../check/language/parse-glossary';
import { technicalWordsOf } from '../check/language/technical-words-of';
import { unknownWords } from '../check/language/unknown-words';
import { CliError } from '../cli-error';
import { toName, type Name } from '../naming';
import { glossaryOf } from './glossary-of';
import type { Scope } from './scope';

/**
 * Refuses a name that carries a technical word no term of the glossary holds, or a word the
 * glossary of the context does not define, the `qualifiers` aside (those of a refusal:
 * `InvalidAppointment`, `BookingTooLate`). `--allow-name` lets any name through.
 */
export function spokenInLanguage(scope: Scope, name: Name, qualifiers: readonly string[] = []): void {
  if (scope.flags.allowName) {
    return;
  }

  const glossary = glossaryOf(scope);
  const file = `${scope.dir}/CONTEXT.md`;

  refuseTechnicalWords(name, glossary, file);
  refuseUnknownWords(name, { glossary, file, qualifiers });
}

function refuseTechnicalWords(name: Name, glossary: Glossary, file: string): void {
  const technical = technicalWordsOf(name.pascal, glossary);

  if (technical.length === 0) {
    return;
  }

  throw new CliError(
    `"${name.pascal}" carries the technical word "${technical.join('", "')}".`,
    `Use the noun or verb a domain expert uses for it, a term of the ubiquitous language (rule language/no-technical-name). If the business does say "${name.title}", define the term in the glossary of ${file}, in the same command: --term "${name.title}=<what it means for the business>". --allow-name lets the name through without it.`,
  );
}

interface Language {
  readonly glossary: Glossary;
  /** The CONTEXT.md that holds the glossary. */
  readonly file: string;
  readonly qualifiers: readonly string[];
}

function refuseUnknownWords(name: Name, { glossary, file, qualifiers }: Language): void {
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
