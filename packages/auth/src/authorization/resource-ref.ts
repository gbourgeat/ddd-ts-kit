/** One element a right may bear on: `{ type: 'invoice', id: 'inv-1' }`. */
export interface ResourceRef {
  readonly type: string;
  readonly id: string;
}
