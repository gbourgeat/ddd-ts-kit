import type { Binding } from '../wiring/binding.js';
import type { BindingOptions } from './binding-options.js';

/** The options a module chains after a binding: each changes the binding it was made for. */
export function bindingOptionsOf(binding: Binding): BindingOptions {
  const options: BindingOptions = {
    as(kind) {
      binding.kind = kind;

      return options;
    },
    singleton() {
      binding.lifetime = 'singleton';

      return options;
    },
    transient() {
      binding.lifetime = 'transient';

      return options;
    },
    with(...aspects) {
      binding.aspects = [...binding.aspects, ...aspects];

      return options;
    },
  };

  return options;
}
