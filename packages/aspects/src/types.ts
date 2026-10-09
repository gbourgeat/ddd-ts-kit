/** The roles a binding declares with `.as(kind)`: the same list as the di and tracing packages. */
export type AspectKind = 'repository' | 'gateway' | 'external' | 'use-case' | 'publisher' | 'consumer';

/** What the composition root knows about the instance it wraps. Everything is optional. */
export interface AspectInfo {
  readonly kind?: AspectKind;
  /** Defaults to the constructor name; set it when the build minifies class names. */
  readonly className?: string;
  /** Bounded context owning the instance. */
  readonly context?: string;
  /** Description of the token the instance is bound to. */
  readonly token?: string;
}

/**
 * Cross-cutting behaviour applied from outside: takes an instance, answers it with its
 * asynchronous methods wrapped. The instance is the same object (a proxy stands in for a
 * frozen one), so `this`, `instanceof` and `#private` members keep working, and applying the
 * same aspect twice is a no-op.
 */
export type Aspect = <T extends object>(instance: T, info?: AspectInfo) => T;

/** One method of one instance: what a selector tests and what an advice is built for. */
export interface JoinPoint {
  readonly instance: object;
  readonly className: string;
  readonly method: string;
  /** Number of declared parameters of the method. */
  readonly arity: number;
  readonly kind?: AspectKind;
  readonly context?: string;
  readonly token?: string;
}

/** One call. `proceed` runs what is inside, with the same arguments unless others are given. */
export interface Invocation {
  readonly args: readonly unknown[];
  readonly proceed: (args?: readonly unknown[]) => Promise<unknown>;
}

export type Advice = (invocation: Invocation) => Promise<unknown>;

/**
 * Builds the advice of one method of one instance, once, when the instance is wrapped: state
 * kept in the closure is per instance and per method. Answering `undefined` leaves the method
 * alone.
 */
export type AdviceFactory = (joinPoint: JoinPoint) => Advice | undefined;

export type Selector = (joinPoint: JoinPoint) => boolean;
