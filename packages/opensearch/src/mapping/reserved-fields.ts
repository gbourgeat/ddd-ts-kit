/** The fields the store keeps beside the row, never given back by `get` or `search`. */
export const RESERVED = Object.freeze({
  /** The stamp of the event that last wrote the document, kept and never indexed. */
  stamp: '_ddd_stamp',
  /** Whether the document is the trace of a deleted row. */
  deleted: '_ddd_deleted',
  /** The order key of each decimal field (`decimalKey`), which a filter and a sort read. */
  order: '_ddd_order',
});

/** Every reserved field starts so: a field of the row may not. */
export const RESERVED_PREFIX = '_ddd_';
