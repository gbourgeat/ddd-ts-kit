/** One element of a parsed XML document: its qualified name, its attributes, its child elements and its text. */
export interface XmlElement {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly XmlElement[];
  /** The text directly inside the element, character data and CDATA sections joined, entities decoded. */
  readonly text: string;
}
