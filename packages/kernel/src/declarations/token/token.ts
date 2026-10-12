/**
 * An injection token is a class: the abstract class of a port, or the abstract class that
 * types a value. The class names the dependency and carries its type, so a constructor
 * parameter typed by it names what is injected and `resolve(Clock)` is typed.
 */
export type Token<T> = abstract new (...args: never) => T;
