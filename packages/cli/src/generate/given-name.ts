import { splitWords, type Name } from '../naming';
import { concept } from './concept';
import type { Scope } from './scope';

/** The element `--name` names, and the role words its generator adds itself after the name. */
export interface NamedElement {
  readonly what: string;
  /** Removed from the end of the given name when the caller typed them: `integration`, `handler`. */
  readonly suffix: readonly string[];
}

/**
 * The name of an element whose generator derives it from another argument (a handler from the
 * event it reacts to): that name, or the one `--name` gives, as the design calls the element,
 * checked as any concept of the context is.
 */
export function givenName(scope: Scope, derived: Name, element: NamedElement): Name {
  const given = scope.flags.name;

  if (given === undefined) {
    return derived;
  }

  return concept(scope, withoutSuffix(given, element.suffix), { what: element.what });
}

function withoutSuffix(input: string, suffix: readonly string[]): string {
  const words = splitWords(input);
  const ending = words.slice(-suffix.length);
  const typed = words.length > suffix.length && ending.every((word, index) => word === suffix[index]);

  return typed ? words.slice(0, -suffix.length).join(' ') : input;
}
