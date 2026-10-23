import type { FieldBlock } from './field-block';
import type { GroupBlock } from './group-block';

/** A block of the neutral tree of a form: a group or a field. */
export type FormBlock = GroupBlock<FormBlock> | FieldBlock<FormBlock>;
