/** A group of blocks of a form, which may hold groups of its own: `Block` is a `FormBlock`. */
export interface GroupBlock<Block = unknown> {
  readonly type: 'group';
  readonly name: string;
  /** A translation key: `<operationId>.<group>`. */
  readonly label: string;
  readonly blocks: readonly Block[];
}
