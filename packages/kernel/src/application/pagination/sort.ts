import type { SortDirection } from './sort-direction.js';

/** `Field` is the closed list of what a read port can sort by; it differs for each port. */
export interface Sort<Field extends string = string> {
  readonly field: Field;
  readonly direction: SortDirection;
}
