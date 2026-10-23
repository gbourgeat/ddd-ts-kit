import type { Buildable } from './buildable';
import { Builder } from './builder';
import type { Defaults } from './defaults';

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
