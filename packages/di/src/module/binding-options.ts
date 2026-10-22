import type { ValueBindingOptions } from './value-binding-options';

export interface BindingOptions extends ValueBindingOptions {
  /** One instance per application. The default. */
  singleton(): this;

  /** A new instance on every resolution. */
  transient(): this;
}
