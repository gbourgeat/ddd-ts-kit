import { SchemaNode } from '../../schema/schema-node';
import { isAsyncIterable } from '../../support/is-async-iterable';
import type { BodyShape } from '../body-shape';
import { malformedBody } from '../malformed-body';
import type { RepresentedBody } from '../represented-body';
import type { Representation } from '../representation';
import { ITEM_ELEMENT, XML_DECLARATION, XSI_NAMESPACE } from './xml-convention';
import { XmlElementWriter } from './xml-element-writer';
import { XmlParser } from './xml-parser';
import { XmlValueReader } from './xml-value-reader';

const MEDIA_TYPE = 'application/xml';

/**
 * `application/xml`, and `application/problem+xml` for a refusal: the JSON model written as XML,
 * element names and attributes taken from the response schema and its XML object, never a
 * vocabulary of its own. A body sent as XML is read back by the same convention into the value
 * the JSON path produces, then validated by the same schema. No library: the parser reads only
 * what a body needs and refuses any document type declaration.
 */
export class XmlRepresentation implements Representation {
  readonly mediaType = MEDIA_TYPE;

  readonly problemMediaType = 'application/problem+xml';

  private readonly writer = new XmlElementWriter();

  private readonly reader = new XmlValueReader();

  write(body: unknown, shape: BodyShape): RepresentedBody {
    const node = SchemaNode.of(shape.schema);
    const root = rootOf(node, shape);

    if (isAsyncIterable(body)) {
      return this.streamed(body, { node, root });
    }

    return `${XML_DECLARATION}${this.writer.element(root.name, body, node).replace(`<${root.name}`, root.open)}`;
  }

  read(text: string, shape: BodyShape): unknown {
    try {
      return this.reader.value(XmlParser.parse(text), SchemaNode.of(shape.schema));
    } catch {
      throw malformedBody(MEDIA_TYPE);
    }
  }

  private async *streamed(items: AsyncIterable<unknown>, { node, root }: Rooted): AsyncIterable<string> {
    const itemNode = node.items();
    const itemName = itemNode.xml().name ?? ITEM_ELEMENT;

    yield `${XML_DECLARATION}${root.open}>`;

    for await (const item of items) {
      yield this.writer.element(itemName, item, itemNode);
    }

    yield `</${root.name}>`;
  }
}

interface Root {
  readonly name: string;
  /** The start tag of the root without its closing bracket: the name and the namespaces it declares. */
  readonly open: string;
}

interface Rooted {
  readonly node: SchemaNode;
  readonly root: Root;
}

function rootOf(node: SchemaNode, shape: BodyShape): Root {
  const { name = shape.name, namespace } = node.xml();
  const declared = namespace === undefined ? '' : ` xmlns="${namespace}"`;

  return { name, open: `<${name}${declared} xmlns:xsi="${XSI_NAMESPACE}"` };
}
