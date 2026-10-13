import type { FieldBlock } from './field-block.js';
import type { GroupBlock } from './group-block.js';

/** A block of the neutral tree of a form: a group or a field. */
export type FormBlock = GroupBlock | FieldBlock;
