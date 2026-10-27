import { heldByGlossary } from '../check/language/held-by-glossary';
import { CliError } from '../cli-error';
import { parseConceptName, splitWords, toName, type Name } from '../naming';
import type { ConceptRole } from './concept-role';
import { glossaryOf } from './glossary-of';
import type { Scope } from './scope';

/** Words that name a technical bucket when a name ends with them, whatever it names. */
const BUCKET_WORDS = ['manager', 'helper', 'util', 'utils', 'data', 'info'];

/**
 * A name that is not a concept of the model (a port, an outside system): its form is checked, and
 * that it does not end with a technical bucket, unless a term of the glossary holds that word.
 */
export function label(scope: Scope, input: string, role: ConceptRole): Name {
  const name = parseConceptName(input, role.what, { strip: role.strip ?? [] });

  if (!scope.flags.allowName) {
    refuseBucket(scope, name);
  }

  return name;
}

function refuseBucket(scope: Scope, name: Name): void {
  const words = splitWords(name.pascal);
  const tail = words.length - 1;
  const last = words[tail] ?? '';

  if (!BUCKET_WORDS.includes(last) || heldByGlossary(words, glossaryOf(scope)).has(tail)) {
    return;
  }

  throw new CliError(
    `"${name.pascal}" ends with "${toName(last).pascal}", which names a technical bucket, not a concept.`,
    `Use a term of the ubiquitous language (what a domain expert would call it). If the business does say "${name.title}", add the row "${name.title}" to the "## Ubiquitous language" table of ${scope.dir}/CONTEXT.md and run the command again, or pass --allow-name.`,
  );
}
