import type { SpanNode } from './span-node';

/**
 * What a spec says of one span. The name and the children are exact: a span that is not
 * listed is a mismatch, and so is a listed one that is missing. The rest is checked when
 * given, except that a span is expected not to be an error unless `status` says so.
 */
export interface ExpectedSpan {
  readonly name: string;
  readonly kind?: SpanNode['kind'];
  /** Default: anything but `ERROR`. */
  readonly status?: SpanNode['status'];
  /** The attributes that matter here. `undefined` expects the attribute to be absent. */
  readonly attributes?: Readonly<Record<string, unknown>>;
  /** In the order they start. Default: none. */
  readonly children?: readonly ExpectedSpan[];
}
