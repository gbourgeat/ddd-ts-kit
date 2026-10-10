/**
 * An injection token is a class: the abstract class of a port, or the abstract class that
 * types a value. The class names the dependency and carries its type, so a dependency list is
 * checked against a constructor and `resolve(Clock)` is typed.
 */
export type Token<T> = abstract new (...args: never) => T;
