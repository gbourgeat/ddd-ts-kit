import type { Defaults } from './defaults';
import { GenericBuilder } from './generic-builder';

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
