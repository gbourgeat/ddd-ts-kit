import type { BindingInfo } from './binding-info';

/**
 * Applied to every instance a binding creates, once per creation. This is where a
 * project plugs cross-cutting wrappers (tracing, metrics) without the wrapped class
 * knowing. It must return the instance or a stand-in of the same type.
 */
export type Decorate = <T>(instance: T, info: BindingInfo) => T;
