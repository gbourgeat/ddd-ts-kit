import { scan } from '../check/scan/scan';
import { callArguments } from '../check/text/call-arguments';
import { escapeRegExp } from '../check/text/escape-reg-exp';
import type { ConceptFactory } from './concept-error-class';

const REFUSAL_CALL = /(?<![\w$])([A-Za-z_$][\w$]*)(\s*\.\s*refusal\s*\()/;

interface Target {
  readonly oldClass: string;
  readonly className: string;
  readonly factory: string;
}

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/**
 * The factory of a class of its own, from a factory of a concept class: renamed, and building its
 * refusal without the code, which the class holds now. Its parameters, its message, its facts and
 * what it chains (`.exposing(..)`, `.causedBy(..)`) are kept as written.
 */
export function ownFactory(factory: ConceptFactory, target: Target): string {
  const { code } = scan(factory.text);
  const declared = new RegExp(`(static\\s+(?:async\\s+)?)${escapeRegExp(factory.name)}(?![\\w$])`).exec(code);
  const called = REFUSAL_CALL.exec(code);

  if (declared === null || called === null) {
    return factory.text;
  }

  const name = declared.index + (declared[1] ?? '').length;
  const receiver = called[1] ?? '';
  const [first, message] = callArguments(code, called.index + called[0].length - 1);

  const edits: Edit[] = [
    { start: name, end: name + factory.name.length, text: target.factory },
    ...(receiver === target.oldClass
      ? [{ start: called.index, end: called.index + receiver.length, text: target.className }]
      : []),
    ...(first === undefined || message === undefined ? [] : [{ start: first.start, end: message.start, text: '' }]),
  ];

  return withSecondArgument(applied(factory.text, edits));
}

function applied(text: string, edits: readonly Edit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((current, edit) => current.slice(0, edit.start) + edit.text + current.slice(edit.end), text);
}

/** The note the generator wrote in a factory of a concept class counts the code as the first argument: it is gone. */
function withSecondArgument(text: string): string {
  return text.replace('give them as the third argument', 'give them as the second argument');
}
