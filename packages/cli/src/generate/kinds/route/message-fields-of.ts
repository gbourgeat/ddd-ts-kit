import { commandInputOf } from '../job/command-input';
import { constructorParameters } from '../job/constructor-parameters';

const MODIFIER = /^(?:public|private|protected|readonly|override)\s/;
const ACTOR = /:\s*Actor\s*$/;

/** One parameter of the constructor of a command or a query past its actor, as its file declares it. */
export interface MessageField {
  readonly name: string;
  /** As written; undefined when only a default value says it. */
  readonly type: string | undefined;
  /** Declared with `?` or given a default. */
  readonly optional: boolean;
}

/**
 * The fields the constructor of a message declares, in order, past the actor a protected one
 * takes first (`actor: Actor`, passed to `super`, or `readonly actor: Actor`). Read from the text,
 * comments left out: the generated message describes a constructor in a `TODO(domain)` before it
 * has one, and has none then.
 */
export function messageFieldsOf(source: string): MessageField[] {
  const [first = '', ...rest] = constructorParameters(withoutComments(source));
  const parameters = ACTOR.test(first.replace(MODIFIER, '')) ? rest : [first, ...rest].filter((one) => one !== '');

  return parameters.map(commandInputOf);
}

function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n');
}
