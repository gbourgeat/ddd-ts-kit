import { commandInputOf } from '../job/command-input';
import { constructorParameters } from '../job/constructor-parameters';
import { withoutComments } from '../job/without-comments';

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
 * takes first, whatever its type says (`actor: Actor` passed to `super`, a property, a default).
 * Read from the text, comments left out: a generated message has no constructor yet.
 */
export function messageFieldsOf(source: string, isProtected: boolean): MessageField[] {
  const parameters = constructorParameters(withoutComments(source));

  return parameters.slice(isProtected ? 1 : 0).map(commandInputOf);
}
