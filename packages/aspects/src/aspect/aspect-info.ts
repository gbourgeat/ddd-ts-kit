import type { AspectKind } from './aspect-kind.js';

/** What the composition root knows about the instance it wraps. Everything is optional. */
export interface AspectInfo {
  readonly kind?: AspectKind;
  /** Defaults to the constructor name; set it when the build minifies class names. */
  readonly className?: string;
  /** Bounded context owning the instance. */
  readonly context?: string;
  /** Description of the port the instance is bound to. */
  readonly token?: string;
}
