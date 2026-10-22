import { escapeRegExp } from '../check/text/escape-reg-exp';
import { replaceInCode } from './replace-in-code';

const IMPORT_LINE = /^\s*import\s/;

/**
 * A case moved to the spec of one class of its own: what still names the concept class there,
 * an assertion `toBeInstanceOf(AppointmentError)` for instance, means that class. Import lines
 * are left: the imports are sorted out after.
 */
export function renameConcept(source: string, concept: string, className: string): string {
  return replaceInCode(
    source,
    new RegExp(`(?<![\\w$.])${escapeRegExp(concept)}(?![\\w$])`, 'g'),
    ({ match, scanned }) => {
      const lineStart = scanned.code.lastIndexOf('\n', match.index - 1) + 1;

      return IMPORT_LINE.test(scanned.code.slice(lineStart, match.index)) ? undefined : { text: className };
    },
  );
}
