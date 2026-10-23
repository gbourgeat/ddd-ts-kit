import { decodeEntities } from './decode-entities';
import type { XmlElement } from './xml-element';
import { XmlSyntaxError } from './xml-syntax-error';

const NAME = /[\p{L}_:][\p{L}\p{N}._:-]*/uy;
const SPACE = /\s*/y;
const ATTRIBUTE_VALUE = /"([^"<]*)"|'([^'<]*)'/y;
const MAX_DEPTH = 64;

interface Content {
  readonly children: XmlElement[];
  text: string;
}

/**
 * Parses the subset of XML 1.0 a request body needs: elements, attributes, character data,
 * CDATA sections, comments, processing instructions, the five predefined entities and character
 * references. A document type declaration is refused, and with it every external or recursive
 * entity: nothing in a body can make the parser read a file or expand without end.
 */
export class XmlParser {
  private position = 0;

  constructor(private readonly source: string) {}

  static parse(source: string): XmlElement {
    return new XmlParser(source).document();
  }

  private document(): XmlElement {
    this.miscellany();

    if (this.source.startsWith('<!DOCTYPE', this.position)) {
      throw new XmlSyntaxError('a document type declaration is not accepted');
    }

    const root = this.element(1);

    this.miscellany();

    if (this.position < this.source.length) {
      throw new XmlSyntaxError('content after the root element');
    }

    return root;
  }

  /** Spaces, comments and processing instructions, where the document allows them. */
  private miscellany(): void {
    for (;;) {
      this.match(SPACE);

      if (this.source.startsWith('<?', this.position)) {
        this.skipPast('?>');
      } else if (this.source.startsWith('<!--', this.position)) {
        this.skipPast('-->');
      } else {
        return;
      }
    }
  }

  private element(depth: number): XmlElement {
    if (depth > MAX_DEPTH) {
      throw new XmlSyntaxError(`elements nested deeper than ${String(MAX_DEPTH)}`);
    }

    this.expect('<');

    const name = this.name();
    const attributes = this.attributes();

    if (this.source.startsWith('/>', this.position)) {
      this.position += 2;

      return { name, attributes, children: [], text: '' };
    }

    this.expect('>');

    const content = this.content(depth);

    this.expect(`</${name}`);
    this.match(SPACE);
    this.expect('>');

    return { name, attributes, ...content };
  }

  private attributes(): Record<string, string> {
    const attributes: Record<string, string> = {};

    for (;;) {
      this.match(SPACE);

      if (!/[\p{L}_:]/u.test(this.source.charAt(this.position))) {
        return attributes;
      }

      const name = this.name();

      this.match(SPACE);
      this.expect('=');
      this.match(SPACE);

      const value = this.match(ATTRIBUTE_VALUE);

      if (value === undefined || Object.hasOwn(attributes, name)) {
        throw new XmlSyntaxError(`the attribute ${name} is malformed or repeated`);
      }

      // Defined, not assigned: an attribute named __proto__ is an attribute like any other.
      Object.defineProperty(attributes, name, {
        value: decodeEntities(value[1] ?? value[2] ?? ''),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }

  private content(depth: number): Content {
    const content: Content = { children: [], text: '' };

    while (!this.source.startsWith('</', this.position)) {
      this.contentPart(content, depth);
    }

    return content;
  }

  private contentPart(content: Content, depth: number): void {
    if (this.position >= this.source.length) {
      throw new XmlSyntaxError('an element is not closed');
    }

    if (this.source.startsWith('<![CDATA[', this.position)) {
      const start = this.position + '<![CDATA['.length;

      content.text += this.source.slice(start, this.skipPast(']]>'));
    } else if (this.source.startsWith('<!--', this.position) || this.source.startsWith('<?', this.position)) {
      this.miscellany();
    } else if (this.source.startsWith('<', this.position)) {
      content.children.push(this.element(depth + 1));
    } else {
      content.text += this.characterData();
    }
  }

  private characterData(): string {
    const end = this.source.indexOf('<', this.position);
    const raw = this.source.slice(this.position, end === -1 ? this.source.length : end);

    this.position += raw.length;

    return decodeEntities(raw);
  }

  private name(): string {
    const name = this.match(NAME)?.[0];

    if (name === undefined) {
      throw new XmlSyntaxError('a name was expected');
    }

    return name;
  }

  private expect(text: string): void {
    if (!this.source.startsWith(text, this.position)) {
      throw new XmlSyntaxError(`"${text}" was expected`);
    }

    this.position += text.length;
  }

  /** Moves past the next `end`, and answers where `end` starts. */
  private skipPast(end: string): number {
    const at = this.source.indexOf(end, this.position);

    if (at === -1) {
      throw new XmlSyntaxError(`"${end}" was expected`);
    }

    this.position = at + end.length;

    return at;
  }

  private match(pattern: RegExp): RegExpExecArray | undefined {
    pattern.lastIndex = this.position;

    const found = pattern.exec(this.source);

    if (found === null) {
      return undefined;
    }

    this.position += found[0].length;

    return found;
  }
}
