import type { Buildable } from './buildable.js';
import type { Defaults } from './defaults.js';
import { isResolvable } from './is-resolvable.js';
import { RESOLVE, type Resolvable } from './resolvable.js';

/**
 * Base class of hand-written test data builders.
 *
 * A subclass declares valid `defaults()` once, says in `construct()` how to create the object
 * through its public API, and exposes methods named in the ubiquitous language that delegate
 * to the protected `with`. Every such method returns a new builder: a builder is immutable,
 * so one instance can be shared between tests without leaking state.
 */
export abstract class Builder<Props extends object, Output> implements Resolvable<Output> {
  // The copy made by `withMany` carries this field: it relies on it being an own enumerable property.
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

    const props = Object.fromEntries(Reflect.ownKeys(values).map((key) => [key, resolveValue(values[key])]));

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

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
