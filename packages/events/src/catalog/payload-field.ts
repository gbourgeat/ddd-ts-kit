export interface PayloadField {
  /** Dotted path; an array is written `lines[]` and its item fields `lines[].sku`. */
  readonly path: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
}
