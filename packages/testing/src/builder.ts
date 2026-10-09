const RESOLVE = Symbol('ddd-ts-kit.testing.resolve');

/** Something that yields a value at build time: a nested builder, `lazy`, `sequence`. */
export interface Resolvable<T> {
  [RESOLVE](): T;
}

/**
 * What a builder accepts wherever a value of type `T` is expected: the value, something that
 * yields it at build time, or, for an array, a list mixing both.
 */
export type Buildable<T> =
  | T
  | Resolvable<T>
  | (T extends readonly (infer Item)[] ? readonly Buildable<Item>[] : never);

/** The defaults of a builder: every required property has one, declared once. */
export type Defaults<Props> = { readonly [K in keyof Props]: Buildable<Props[K]> };

class Lazy<T> implements Resolvable<T> {
  constructor(private readonly produce: () => T) {}

  [RESOLVE](): T {
    return this.produce();
  }
}

/** A default computed at each `build()`, for values that must not be shared between tests. */
export function lazy<T>(produce: () => T): Resolvable<T> {
  return new Lazy(produce);
}

const counters = new Map<string, number>();

/**
 * A default drawn from a named, deterministic sequence: `sequence('order')` gives `order-1`,
 * `order-2`... The counter is shared by every builder using the same name.
 */
export function sequence(name: string): Resolvable<string>;
export function sequence<T>(name: string, format: (n: number) => T): Resolvable<T>;
export function sequence(
  name: string,
  format: (n: number) => unknown = (n) => `${name}-${n}`,
): Resolvable<unknown> {
  return new Lazy(() => {
    const next = (counters.get(name) ?? 0) + 1;
    counters.set(name, next);
    return format(next);
  });
}

/** Restarts every sequence at 1. Call it in `beforeEach` so tests do not depend on their order. */
export function resetSequences(): void {
  counters.clear();
}

/**
 * Base class of hand-written test data builders.
 *
 * A subclass declares valid `defaults()` once, says in `construct()` how to create the object
 * through its public API, and exposes methods named in the ubiquitous language that delegate
 * to the protected `with`. Every such method returns a new builder: a builder is immutable,
 * so one instance can be shared between tests without leaking state.
 */
export abstract class Builder<Props extends object, Output> implements Resolvable<Output> {
  // A TypeScript-private field rather than `#overrides`: the copy made by `with` has to carry
  // it, and a hard-private field cannot be installed on an object the constructor did not run for.
  private readonly overrides: Partial<Defaults<Props>> = {};

  /** Valid defaults. Called at each build, so `lazy` and `sequence` yield fresh values. */
  protected abstract defaults(): Defaults<Props>;

  /** Creates the object through its public API, so it can never start in an invalid state. */
  protected abstract construct(props: Props): Output;

  build(): Output {
    return this.construct(this.props());
  }

  /** Builds `count` objects, each with its own lazy and sequence values. */
  buildMany(count: number, customize: (builder: this, index: number) => this = (b) => b): Output[] {
    return Array.from({ length: count }, (_, index) => customize(this, index).build());
  }

  [RESOLVE](): Output {
    return this.build();
  }

  /**
   * What `build()` hands to `construct`: the defaults, then the values set, all resolved. A
   * subclass uses it to offer another output of the same vocabulary, such as the request
   * payload of an API (`buildRequest()`). Each call draws its own lazy and sequence values.
   */
  protected props(): Props {
    const values: Record<PropertyKey, unknown> = { ...this.defaults(), ...this.overrides };
    const props = Object.fromEntries(
      Reflect.ownKeys(values).map((key) => [key, resolveValue(values[key])]),
    );
    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- every key of Props was resolved to its value type above, which the compiler cannot follow through Object.fromEntries
    return props as Props;
  }

  /** Adds items to an array property, after the ones already set or declared by default. */
  protected adding<K extends keyof Props>(
    key: K,
    ...items: Props[K] extends readonly (infer Item)[] ? Buildable<Item>[] : never
  ): this {
    const current: unknown = key in this.overrides ? this.overrides[key] : this.defaults()[key];
    if (!isList(current)) {
      throw new TypeError(
        `adding("${String(key)}") needs the current value to be a list, not a lazy value or a builder`,
      );
    }
    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the element type was checked on `items`; the conditional type cannot be derived again from the list
    return this.with(key, [...current, ...items] as Buildable<Props[K]>);
  }

  protected with<K extends keyof Props>(key: K, value: Buildable<Props[K]>): this {
    const values: { [Key in keyof Props]?: Buildable<Props[Key]> } = {};
    values[key] = value;
    return this.withMany(values);
  }

  protected withMany(values: Partial<Defaults<Props>>): this {
    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- Object.create is untyped; the copy has the prototype of `this`, so it is a `this`
    const copy = Object.create(Reflect.getPrototypeOf(this)) as this;
    return Object.assign(copy, this, { overrides: { ...this.overrides, ...values } });
  }
}

// Arrays are walked so builders can sit in a list; plain objects are left alone because a
// domain object must never be rewritten by the builder that carries it.
function resolveValue(value: unknown): unknown {
  if (isResolvable(value)) {
    return resolveValue(value[RESOLVE]());
  }
  return Array.isArray(value) ? value.map(resolveValue) : value;
}

function isResolvable(value: unknown): value is Resolvable<unknown> {
  return typeof value === 'object' && value !== null && RESOLVE in value;
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** The builder `defineBuilder` gives: the generic `with` and `withMany`, made public. */
export class GenericBuilder<Props extends object, Output> extends Builder<Props, Output> {
  constructor(
    private readonly definition: {
      readonly defaults: Defaults<Props> | (() => Defaults<Props>);
      readonly build: (props: Props) => Output;
    },
  ) {
    super();
  }

  override with<K extends keyof Props>(key: K, value: Buildable<Props[K]>): this {
    return super.with(key, value);
  }

  override withMany(values: Partial<Defaults<Props>>): this {
    return super.withMany(values);
  }

  protected defaults(): Defaults<Props> {
    const { defaults } = this.definition;
    return typeof defaults === 'function' ? defaults() : defaults;
  }

  protected construct(props: Props): Output {
    return this.definition.build(props);
  }
}

/**
 * Functional form, for plain data (DTOs, payloads, value objects) that does not deserve a
 * class: `const aLine = defineBuilder<LineProps>({ defaults: {...} })`, then `aLine().with(...)`.
 */
export function defineBuilder<Props extends object>(definition: {
  readonly defaults: Defaults<Props> | (() => Defaults<Props>);
}): () => GenericBuilder<Props, Props>;
export function defineBuilder<Props extends object, Output>(definition: {
  readonly defaults: Defaults<Props> | (() => Defaults<Props>);
  readonly build: (props: Props) => Output;
}): () => GenericBuilder<Props, Output>;
export function defineBuilder<Props extends object>(definition: {
  readonly defaults: Defaults<Props> | (() => Defaults<Props>);
  readonly build?: (props: Props) => unknown;
}): () => GenericBuilder<Props, unknown> {
  const builder = new GenericBuilder<Props, unknown>({
    defaults: definition.defaults,
    build: definition.build ?? ((props) => props),
  });
  // Immutable, so every call can hand out the same instance.
  return () => builder;
}

/** Builds the value when given a builder, returns it untouched otherwise. */
export function resolve<T>(value: T | Resolvable<T>): T {
  return isResolvable(value) ? value[RESOLVE]() : value;
}
