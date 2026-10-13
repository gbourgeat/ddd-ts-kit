/** The XML object of OpenAPI on a schema node: what renames an element, makes a scalar an attribute or wraps a list. */
export interface XmlHints {
  readonly name?: string;
  readonly attribute?: boolean;
  readonly wrapped?: boolean;
  /** The default namespace declared on the element, read on the root only. */
  readonly namespace?: string;
}
