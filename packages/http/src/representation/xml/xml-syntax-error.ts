/** A body that is not the XML the parser reads: answered as a malformed body, never quoted. */
export class XmlSyntaxError extends Error {
  constructor(reason: string) {
    super(`The XML is not well formed: ${reason}.`);
    this.name = 'XmlSyntaxError';
  }
}
