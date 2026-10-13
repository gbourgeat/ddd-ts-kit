import { SchemaNode } from '../../schema/schema-node.js';
import { ENTRY_ELEMENT, KEY_ATTRIBUTE } from './xml-convention.js';
import type { XmlElement } from './xml-element.js';

const NUMBER = /^\s*-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?\s*$/;
const BOOLEANS: Readonly<Record<string, boolean>> = { true: true, false: false, 1: true, 0: false };
/** What a document declares about itself, never a value: namespaces and the attributes of the XSI namespace. */
const DECLARATION = /^(?:xmlns(?::|$)|xsi:)/;
/** A schema that declares nothing, for what the schema of the body does not describe. */
const NOTHING = SchemaNode.of({});

/**
 * Reads a parsed element back into the value the JSON path produces, by the same convention and
 * the same schema the writer uses: text becomes a number or a boolean where the schema says so,
 * repeated elements a list. What the schema does not declare is kept as it was read, so that the
 * schema refuses it as it refuses an unknown JSON property.
 */
export class XmlValueReader {
  value(element: XmlElement, node: SchemaNode): unknown {
    if (isNil(element)) {
      return null;
    }

    const type = node.type();

    if (type === 'array') {
      return element.children.map((child) => this.value(child, node.items()));
    }

    if (type === 'object' || (type === undefined && element.children.length > 0)) {
      return this.record(element, node);
    }

    return scalar(element.text, node);
  }

  private record(element: XmlElement, node: SchemaNode): Record<string, unknown> {
    const record: Record<string, unknown> = {};
    const claimed = new Set<XmlElement>();

    for (const [key, child] of node.properties()) {
      const read = this.member(element, { key, node: child }, claimed);

      if (read !== undefined) {
        record[key] = read;
      }
    }

    this.undeclared(element, claimed, record);

    return record;
  }

  private member(element: XmlElement, { key, node }: Member, claimed: Set<XmlElement>): unknown {
    const hints = node.xml();
    const name = hints.name ?? key;

    if (hints.attribute === true) {
      const text = element.attributes[name];

      return text === undefined ? undefined : scalar(text, node);
    }

    const named = element.children.filter((child) => isNamed(child, name) && !claimed.has(child));

    named.forEach((child) => claimed.add(child));

    if (node.type() !== 'array' || hints.wrapped === true) {
      return named[0] === undefined ? undefined : this.value(named[0], node);
    }

    return named.map((child) => this.value(child, node.items()));
  }

  private undeclared(element: XmlElement, claimed: ReadonlySet<XmlElement>, record: Record<string, unknown>): void {
    for (const child of element.children.filter((candidate) => !claimed.has(candidate))) {
      const key = keyOf(child);
      const value: unknown = child.children.length > 0 ? this.record(child, NOTHING) : child.text;
      const earlier = record[key];

      record[key] = earlier === undefined ? value : [earlier, value].flat();
    }

    for (const [name, text] of Object.entries(element.attributes)) {
      if (!DECLARATION.test(name) && !(name in record)) {
        record[name] = text;
      }
    }
  }
}

interface Member {
  readonly key: string;
  readonly node: SchemaNode;
}

function isNil(element: XmlElement): boolean {
  return Object.entries(element.attributes).some(
    ([name, value]) => (name === 'nil' || name.endsWith(':nil')) && (value === 'true' || value === '1'),
  );
}

function isNamed(element: XmlElement, name: string): boolean {
  return element.name === name || (element.name === ENTRY_ELEMENT && element.attributes[KEY_ATTRIBUTE] === name);
}

function keyOf(element: XmlElement): string {
  return element.name === ENTRY_ELEMENT ? (element.attributes[KEY_ATTRIBUTE] ?? element.name) : element.name;
}

function scalar(text: string, node: SchemaNode): unknown {
  const type = node.type();

  if ((type === 'number' || type === 'integer') && NUMBER.test(text)) {
    return Number(text);
  }

  if (type === 'boolean') {
    return BOOLEANS[text.trim()] ?? text;
  }

  return text;
}
