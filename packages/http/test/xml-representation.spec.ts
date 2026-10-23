import { describe, expect, it } from 'vitest';
import { XmlRepresentation, type BodyShape } from '../src';

const xml = new XmlRepresentation();
const DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const XSI = 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';

const order: BodyShape = {
  name: 'getOrder',
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string', xml: { attribute: true } },
      lines: { type: 'array', items: { $ref: '#/$defs/Line' } },
      tags: { type: 'array', items: { type: 'string', xml: { name: 'tag' } }, xml: { wrapped: true } },
      note: { type: ['string', 'null'] },
      paid: { type: 'boolean' },
      total: { anyOf: [{ type: 'null' }, { type: 'number' }] },
      metadata: { type: 'object', additionalProperties: { type: 'string' } },
    },
    $defs: { Line: { type: 'object', properties: { sku: { type: 'string' }, quantity: { type: 'integer' } } } },
  },
};

const value = {
  lines: [
    { sku: 'A<1>', quantity: 2 },
    { sku: 'B&2', quantity: 1 },
  ],
  id: 'o-1',
  tags: ['gift', 'urgent'],
  note: null,
  paid: true,
  total: 12.5,
  metadata: { 'two words': 'x', origin: 'web' },
};

const written =
  `${DECLARATION}<getOrder ${XSI} id="o-1">` +
  '<lines><sku>A&lt;1&gt;</sku><quantity>2</quantity></lines>' +
  '<lines><sku>B&amp;2</sku><quantity>1</quantity></lines>' +
  '<tags><tag>gift</tag><tag>urgent</tag></tags>' +
  `<note xsi:nil="true"/><paid>true</paid><total>12.5</total>` +
  '<metadata><entry key="two words">x</entry><origin>web</origin></metadata>' +
  '</getOrder>';

describe('the XML convention of the kit', () => {
  it('writes properties as elements in the order of the schema, attributes, unwrapped and wrapped lists, nil and entries', () => {
    expect(xml.write(value, order)).toBe(written);
  });

  it('reads what it wrote back into the value the JSON path produces', () => {
    expect(xml.read(written, order)).toEqual(value);
  });

  it('writes a list at the root as one item element per item, unless the items name theirs', () => {
    const shape = { name: 'searchTags', schema: { type: 'array', items: { type: 'string' } } };

    expect(xml.write(['a', 'b'], shape)).toBe(
      `${DECLARATION}<searchTags ${XSI}><item>a</item><item>b</item></searchTags>`,
    );

    expect(xml.read('<x><item>a</item><item>b</item></x>', shape)).toEqual(['a', 'b']);
  });

  it('takes the name of the root from the schema when it gives one', () => {
    expect(xml.write({}, { name: 'getOrder', schema: { type: 'object', xml: { name: 'order' } } })).toBe(
      `${DECLARATION}<order ${XSI}></order>`,
    );
  });

  it('writes an instant in ISO 8601 UTC, a big integer in full, and leaves out a missing value', () => {
    const shape = { name: 'stamp', schema: { type: 'object' } };
    const at = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));

    expect(xml.write({ at, count: 12345678901234567890n, gone: undefined }, shape)).toBe(
      `${DECLARATION}<stamp ${XSI}><at>2026-01-02T03:04:05.000Z</at><count>12345678901234567890</count></stamp>`,
    );
  });

  it('replaces a character XML cannot carry, so that the document stays well formed', () => {
    expect(xml.write({ text: 'a\u0001b' }, { name: 'r', schema: {} })).toContain('<text>a�b</text>');
  });

  it('keeps as text a value the schema does not type, and what a number or a boolean element does not hold', () => {
    const shape = {
      name: 'r',
      schema: { type: 'object', properties: { n: { type: 'integer' }, b: { type: 'boolean' } } },
    };

    expect(xml.read('<r><n>x</n><b>maybe</b><extra>1</extra><extra>2</extra></r>', shape)).toEqual({
      n: 'x',
      b: 'maybe',
      extra: ['1', '2'],
    });
  });

  it('reads CDATA, comments, processing instructions and character references', () => {
    const shape = { name: 'r', schema: { type: 'object', properties: { t: { type: 'string' } } } };

    const source =
      '<?xml version="1.0"?><!-- before --><r a=\'1\'><!-- c --><t><![CDATA[<b>]]>&#65;&#x42;&apos;</t><?pi x?></r><!-- after -->';

    expect(xml.read(source, shape)).toEqual({ t: "<b>AB'", a: '1' });
  });

  it('refuses a document type declaration, and with it every entity it could declare', () => {
    const attack = '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>';

    expect(() => xml.read(attack, { name: 'r', schema: {} })).toThrow('The request is not valid.');
  });

  it('reads names an object inherits as names of the document, never as what the object inherits', () => {
    const shape = { name: 'r', schema: { type: 'object', properties: { b: { type: 'boolean' } } } };

    const read = xml.read(
      '<r constructor="c"><b>constructor</b><__proto__><polluted>yes</polluted></__proto__></r>',
      shape,
    );

    expect(read).toEqual({ b: 'constructor', constructor: 'c', ['__proto__']: { polluted: 'yes' } });
    expect(Object.getPrototypeOf(read)).toBe(Object.prototype);
    expect(Object.keys(read as object)).toEqual(['b', '__proto__', 'constructor']);
  });

  it.each([
    ['an undeclared entity', '<r>&x;</r>'],
    ['an entity named after what an object inherits', '<r>&constructor;&toString;</r>'],
    ['a lone ampersand', '<r>a & b</r>'],
    ['an element left open', '<r><a></r>'],
    ['content after the root', '<r/><s/>'],
    ['a repeated attribute', '<r a="1" a="2"/>'],
    ['an attribute without quotes', '<r a=1/>'],
    ['an unterminated comment', '<r><!-- </r>'],
    ['a character reference out of range', '<r>&#0;</r>'],
    ['no root at all', '   '],
    ['elements nested beyond the limit', `${'<a>'.repeat(65)}${'</a>'.repeat(65)}`],
  ])('refuses %s', (_case, source) => {
    expect(() => xml.read(source, { name: 'r', schema: {} })).toThrow('The request is not valid.');
  });
});
