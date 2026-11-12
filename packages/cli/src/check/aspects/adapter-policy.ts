import type { SourceFile } from '../model/source-file';
import type { StatedPolicy } from './stated-policy';

/** What the declaration or the binding of one adapter says of its policy, read as text. */
export interface AdapterPolicy extends StatedPolicy {
  /** The port the adapter is bound to. */
  readonly port: string;
  /** Undefined for a binding that names no class (`toValue`, `toFactory`): it still binds the port. */
  readonly className: string | undefined;
  /** The file that states it: the one of the class in the declared style, the one that binds it otherwise. */
  readonly source: SourceFile;
  /** `external`, `gateway`, or whatever is stated; undefined when the adapter has no kind, or one the text does not show. */
  readonly kind: string | undefined;
  /** False when the kind is written as anything but a literal. */
  readonly kindKnown: boolean;
  /** True for a binding that runs in some cases only: under a condition, a loop, a ternary, `when(...)`. */
  readonly conditional: boolean;
}
