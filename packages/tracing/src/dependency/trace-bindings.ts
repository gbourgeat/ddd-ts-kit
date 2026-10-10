import type { DependencyKind } from '@ddd-ts-kit/kernel';
import { traceDependency } from './trace-dependency.js';

/** What the `decorate` hook of an application says about the binding an instance comes from. */
export interface TracedBinding {
  /** Name of the module that declared the binding. */
  readonly context: string;
  /** The role the binding was declared with. A binding without one is not traced. */
  readonly kind?: DependencyKind;
}

/**
 * The `decorate` hook that traces an application: `createApplication({ modules, decorate:
 * traceBindings() })`. Every instance of a binding declared with a kind is wrapped by
 * `traceDependency` under the name of its context; anything else is handed out untouched.
 */
export function traceBindings(): <T>(instance: T, binding: TracedBinding) => T {
  return (instance, { context, kind }) => {
    if (kind === undefined || typeof instance !== 'object' || instance === null) return instance;

    return traceDependency(instance, { kind, context });
  };
}
