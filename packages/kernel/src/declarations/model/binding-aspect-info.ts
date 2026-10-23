import type { DependencyKind } from '../../application/dependency-kind';

/** What an aspect is told about the instance it wraps. */
export interface BindingAspectInfo {
  readonly kind?: DependencyKind;
  /** The bound class, or the constructor name of what a factory or a value gave. */
  readonly className: string;
  /** Name of the module that declared the binding. */
  readonly context: string;
  /** Description of the bound token. */
  readonly token: string;
}
