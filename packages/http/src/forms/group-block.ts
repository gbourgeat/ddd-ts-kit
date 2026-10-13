import type { FormBlock } from './form-block.js';

/** A group of blocks of a form, which may hold groups of its own. */
export interface GroupBlock {
  readonly type: 'group';
  readonly name: string;
  /** A translation key: `<operationId>.<group>`. */
  readonly label: string;
  readonly blocks: readonly FormBlock[];
}
