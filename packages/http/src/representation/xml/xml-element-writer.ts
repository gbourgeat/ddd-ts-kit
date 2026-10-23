import { SchemaNode } from '../../schema/schema-node';
import { isRecord } from '../../support/is-record';
import { wireText } from '../wire-text';
import { ENTRY_ELEMENT, ITEM_ELEMENT, KEY_ATTRIBUTE, NIL_ATTRIBUTE } from './xml-convention';
import { isXmlName } from './is-xml-name';
import { xmlText } from './xml-text';

const ANY = SchemaNode.of({});

/** The name of an element and the attributes it carries whatever its value, written. */
interface Tag {
  readonly name: string;
  readonly attributes: string;
}

/**
 * Writes one value as XML by the convention of the kit, which is the default of the XML object
 * of OpenAPI: a property is an element of its name, a scalar marked `xml.attribute` an attribute,
 * a list one element per item named after the property unless `xml.wrapped`, `null` an empty
 * element with `xsi:nil="true"` and a missing value nothing at all.
 */
export class XmlElementWriter {
  element(name: string, value: unknown, node: SchemaNode): string {
    return this.tagged({ name, attributes: '' }, value, node);
  }

  items(values: readonly unknown[], node: SchemaNode): string {
    const items = node.items();
    const name = items.xml().name ?? ITEM_ELEMENT;

    return values.map((value) => this.element(name, value, items)).join('');
  }

  private tagged({ name, attributes }: Tag, value: unknown, node: SchemaNode): string {
    if (value === null) {
      return `<${name}${attributes} ${NIL_ATTRIBUTE}/>`;
    }

    if (Array.isArray(value)) {
      return `<${name}${attributes}>${this.items(value, node)}</${name}>`;
    }

    if (isRecord(value) && !(value instanceof Date)) {
      return `<${name}${attributes}${this.attributesOf(value, node)}>${this.members(value, node)}</${name}>`;
    }

    return `<${name}${attributes}>${xmlText(wireText(value) ?? '')}</${name}>`;
  }

  private attributesOf(record: Readonly<Record<string, unknown>>, node: SchemaNode): string {
    return node
      .properties()
      .filter(([, child]) => child.xml().attribute === true)
      .map(([key, child]) => ({ name: child.xml().name ?? key, text: wireText(record[key]) }))
      .map(({ name, text }) => (text === undefined ? '' : ` ${name}="${xmlText(text)}"`))
      .join('');
  }

  private members(record: Readonly<Record<string, unknown>>, node: SchemaNode): string {
    const declared = new Map(node.properties());

    return Object.entries(record)
      .filter(([key]) => declared.get(key)?.xml().attribute !== true)
      .sort(([a], [b]) => orderOf(declared, a) - orderOf(declared, b))
      .map(([key, value]) => this.member(key, value, declared.get(key) ?? ANY))
      .join('');
  }

  private member(key: string, value: unknown, node: SchemaNode): string {
    if (value === undefined) {
      return '';
    }

    const name = node.xml().name ?? key;

    if (!isXmlName(name)) {
      return this.tagged({ name: ENTRY_ELEMENT, attributes: ` ${KEY_ATTRIBUTE}="${xmlText(name)}"` }, value, node);
    }

    if (Array.isArray(value) && node.xml().wrapped !== true) {
      const items = node.items();

      return value.map((item) => this.element(items.xml().name ?? name, item, items)).join('');
    }

    return this.element(name, value, node);
  }
}

/** Declared properties first, in the order of the schema; the others after, in the order of the value. */
function orderOf(declared: ReadonlyMap<string, SchemaNode>, key: string): number {
  const index = [...declared.keys()].indexOf(key);

  return index === -1 ? declared.size : index;
}
