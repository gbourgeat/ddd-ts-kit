import type { BindingAspectInfo } from './binding-aspect-info.js';

/**
 * Cross-cutting behaviour put around one binding: it answers the instance or a stand-in of the
 * same type. An `Aspect` of `@ddd-ts-kit/aspects` fits as it is.
 */
export type BindingAspect = <T extends object>(instance: T, info: BindingAspectInfo) => T;
