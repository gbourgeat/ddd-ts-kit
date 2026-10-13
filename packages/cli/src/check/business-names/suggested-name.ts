import { plural, singular } from '../../naming/index.js';
import type { NamedBinding } from './named-binding.js';

const BUILT = /^(?:await\s+)?(?:new\s+([A-Z][\w$]*)\s*[(<]|([A-Z][\w$]*)\.create\s*[(<])/;
const READ = /^(?:await\s+)?(?:this\s*\.\s*)?([a-z][\w$]*)Repository\s*\.\s*[\w$]+\s*\(/;
const LAST_WORD = /([A-Za-z][a-z\d]*)$/;

/**
 * The business name the code already gives to what a binding holds, as the checker reads it from
 * the text: the class an initializer builds or the repository it reads, the singular of the
 * collection a loop walks through. Undefined when the text says nothing.
 */
export function suggestedName(binding: NamedBinding): string | undefined {
  const source = binding.source ?? '';

  if (binding.kind === 'loop variable') {
    return elementOf(source);
  }

  const built = BUILT.exec(source);
  const concept = built?.[1] ?? built?.[2] ?? READ.exec(source)?.[1];

  if (concept === undefined) {
    return undefined;
  }

  const camel = concept.charAt(0).toLowerCase() + concept.slice(1);

  return singular(binding.name) === undefined ? camel : plural(camel);
}

/** `reminder` for `dueReminders` or `this.reminders`; nothing for a collection whose name is not a plural. */
function elementOf(collection: string): string | undefined {
  const last = LAST_WORD.exec(collection)?.[1];

  return last === undefined ? undefined : singular(last.toLowerCase());
}
