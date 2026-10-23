import type { Finding } from '../../check/model/finding';
import type { TokenReference } from './token-reference';

/** What a declared class is given, read from its source: the list of its decorator, and its constructor. */
export interface ClassInjection {
  readonly className: string;
  /** The role file that declares the class, from the project root. */
  readonly file: string;
  /** Line of the declaration decorator. */
  readonly line: number;
  /** The names the decorator lists, when it carries a list: that list then wins over the signature. */
  readonly listed: readonly string[] | undefined;
  /** One token per constructor parameter, in order; undefined when the constructor could not be read as tokens. */
  readonly dependencies: readonly TokenReference[] | undefined;
  /** Why the constructor does not state the dependencies, each with the fix. */
  readonly problems: readonly Finding[];
  /** False when the class inherits its constructor from a class this project cannot read. */
  readonly readable: boolean;
}
