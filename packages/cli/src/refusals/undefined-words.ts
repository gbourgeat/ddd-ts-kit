import { parseGlossary } from '../check/language/parse-glossary';
import { REFUSAL_QUALIFIERS } from '../check/language/refusal-qualifiers';
import { unknownWords } from '../check/language/unknown-words';
import type { Config } from '../config';
import type { MigrationDraft } from './migration-draft';

/** A refusal class the migration proposes or writes, in its context. */
export interface ClassInContext {
  readonly context: string;
  readonly className: string;
}

/**
 * What the language leaves to a person: each class whose name uses words the glossary of its
 * context does not define, the qualifiers of a refusal aside. Under the named form every class of
 * `domain/errors/` is judged by language/glossary-term, as an aggregate is; the migration names a
 * class after its code, which the glossary was never asked about.
 */
export function undefinedWords(classes: readonly ClassInContext[], config: Config, draft: MigrationDraft): string[] {
  const said = new Set<string>();

  return classes.flatMap(({ context, className }) => {
    const doc = `${config.contextsDir}/${context}/CONTEXT.md`;
    const unknown = unknownWords(className, parseGlossary(draft.read(doc) ?? ''), REFUSAL_QUALIFIERS);
    const key = `${context}/${className}`;

    if (unknown.length === 0 || said.has(key)) {
      return [];
    }

    said.add(key);

    const words = unknown.map((word) => `"${word}"`).join(', ');

    return [
      `\`${className}\` uses ${words}, which the glossary of "${context}" does not define: define them in ${doc} or rename the class in the plan.`,
    ];
  });
}
