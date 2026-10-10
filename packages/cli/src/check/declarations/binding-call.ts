import type { ListPart } from '../text/list-part.js';

/** A call that names an injection token: `bind(X)`, `rebind(X)`, `resolve(X)`, `fake(X, ..)` or `override(X, ..)`. */
export interface BindingCall {
  readonly method: string;
  readonly line: number;
  /** Offsets of the parentheses around the arguments. */
  readonly open: number;
  readonly close: number;
  /** The first argument, when the call has one. */
  readonly token: ListPart | undefined;
}
