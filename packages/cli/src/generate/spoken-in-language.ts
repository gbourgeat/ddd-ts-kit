import type { Glossary } from '../check/language/parse-glossary';
import { technicalWordsOf } from '../check/language/technical-words-of';
import { unknownWords } from '../check/language/unknown-words';
import { CliError } from '../cli-error';
import { toName, type Name } from '../naming';
import { glossaryOf } from './glossary-of';
import type { Scope } from './scope';

/** A name and the others the same command writes. */
export interface Together {
  readonly name: Name;
  readonly alongside: readonly Name[];
}

/**
 * Refuses a name that carries a technical word no term of the glossary holds, or a word the
 * glossary of the context does not define, the `qualifiers` aside (those of a refusal:
 * `InvalidAppointment`, `BookingTooLate`). `--allow-name` lets any name through. A probe of the
 * language hears the name instead, and the generator goes on. The `alongside` names, written by the
 * same command, are judged for unknown words with it, so that one refusal lists every missing term.
 */
export function spokenInLanguage(scope: Scope, judged: Name | Together, qualifiers: readonly string[] = []): void {
  const { name, alongside } = 'alongside' in judged ? judged : { name: judged, alongside: [] };

  if (scope.flags.allowName) {
    return;
  }

  if (scope.flags.language !== undefined) {
    scope.flags.language({ context: scope.context.kebab, dir: scope.dir, name: name.pascal, qualifiers });

    return;
  }

  const glossary = glossaryOf(scope);
  const file = `${scope.dir}/CONTEXT.md`;

  refuseTechnicalWords(name, glossary, file);
  refuseUnknownWords([name, ...alongside], { glossary, file, qualifiers });
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

function refuseUnknownWords(names: readonly Name[], { glossary, file, qualifiers }: Language): void {
  const judged = names
    .map((name) => ({ name, unknown: unknownWords(name.pascal, glossary, qualifiers) }))
    .filter(({ unknown }) => unknown.length > 0);

  if (judged.length === 0) {
    return;
  }

  const terms =
    glossary.terms.length > 0
      ? `use an existing term (${glossary.terms.join(', ')})`
      : 'define the ubiquitous language first';

  const known = qualifiers.length > 0 ? `${terms} or a qualifier of a refusal (${qualifiers.join(', ')})` : terms;
  const unknown = [...new Set(judged.flatMap((entry) => entry.unknown))];
  const flags = unknown.map((word) => `--term "${toName(word).pascal}=<what it means for the business>"`).join(' ');

  const uses = judged
    .map((entry) => `"${entry.name.pascal}" uses ${entry.unknown.map((word) => `"${word}"`).join(', ')}`)
    .join(' and ');

  throw new CliError(
    `${uses}, which the glossary of ${file} does not define.`,
    `Either ${known}, or add the term in the same command: ${flags}. The glossary is written before the code (rule language/glossary-term).`,
  );
}
