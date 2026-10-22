import { describe, expect, it } from 'vitest';
import {
  CsvRepresentation,
  JsonRepresentation,
  XmlRepresentation,
  decimalText,
  money,
  pageResponse,
  type BodyShape,
} from '../src';

/** A closed vocabulary, as the kit declares one: an object of codes and the union of its values. */
const Status = { booked: 'booked', cancelled: 'cancelled' } as const;

const at = new Date(Date.UTC(2026, 9, 13, 7, 5));

const page = pageResponse(
  { items: [{ id: 42n, at, fee: money('25.00', 'EUR'), status: Status.booked }], total: 1 },
  (row) => ({
    id: String(row.id),
    at,
    fee: row.fee.amount,
    currency: row.fee.currency,
    status: row.status,
  }),
);

const shape: BodyShape = {
  name: 'searchVisits',
  schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            at: { type: 'string', format: 'date-time' },
            fee: { type: 'string' },
            currency: { type: 'string' },
            status: { enum: ['booked', 'cancelled'] },
          },
        },
      },
      total: { type: 'integer' },
    },
  },
};

async function text(written: string | AsyncIterable<string>): Promise<string> {
  if (typeof written === 'string') {
    return written;
  }

  let all = '';

  for await (const chunk of written) {
    all += chunk;
  }

  return all;
}

describe('the serialization rules every representation follows, held once', () => {
  it('writes an instant in ISO 8601 UTC, money as a decimal string with its currency, an identifier as a string, a vocabulary by its code, in the page envelope', async () => {
    const json = await text(new JsonRepresentation().write(page));
    const xml = await text(new XmlRepresentation().write(page, shape));
    const csv = await text(new CsvRepresentation().write(page, shape));

    expect(JSON.parse(json)).toEqual({
      items: [{ id: '42', at: '2026-10-13T07:05:00.000Z', fee: '25.00', currency: 'EUR', status: 'booked' }],
      total: 1,
    });

    expect(xml).toContain(
      '<items><id>42</id><at>2026-10-13T07:05:00.000Z</at><fee>25.00</fee><currency>EUR</currency><status>booked</status></items><total>1</total>',
    );

    expect(csv).toBe('id,at,fee,currency,status\r\n42,2026-10-13T07:05:00.000Z,25.00,EUR,booked\r\n');
  });

  it('writes a big integer as a string in JSON, where a number would lose digits', async () => {
    expect(await text(new JsonRepresentation().write({ id: 9007199254740993n }))).toBe('{"id":"9007199254740993"}');
  });

  it('writes a streamed list as one JSON array', async () => {
    async function* two(): AsyncIterable<unknown> {
      yield { n: 1 };
      yield undefined;
    }

    expect(await text(new JsonRepresentation().write(two()))).toBe('[{"n":1},null]');
  });

  it('keeps a decimal as written, and refuses one a client would round or misread', () => {
    expect(decimalText('0.10')).toBe('0.10');
    expect(decimalText(12)).toBe('12');
    expect(decimalText(-3n)).toBe('-3');
    expect(() => decimalText(1e21)).toThrow(RangeError);
    expect(() => decimalText('1,5')).toThrow(RangeError);
  });

  it('writes a negative amount in CSV as the number it is, and still guards a text a spreadsheet would run', async () => {
    const shape = {
      name: 'ledger',
      schema: { type: 'array', items: { type: 'object', properties: { amount: {}, label: {} } } },
    };

    const rows = [
      { amount: money('-12.50', 'EUR').amount, label: '-2+3' },
      { amount: '+4', label: '=1+1' },
    ];

    expect(await text(new CsvRepresentation().write(rows, shape))).toBe("amount,label\r\n-12.50,'-2+3\r\n+4,'=1+1\r\n");
  });

  it('never writes money without an ISO 4217 currency', () => {
    expect(money('9.99', 'USD')).toEqual({ amount: '9.99', currency: 'USD' });
    expect(() => money('9.99', 'usd')).toThrow(RangeError);
  });

  it('refuses a JSON body that is not well formed', () => {
    expect(() => new JsonRepresentation().read('{')).toThrow('The request is not valid.');
  });
});
