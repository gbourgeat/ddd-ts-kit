import { bodyOf } from './body-of';
import { FakeRefusal } from './fake-refusal';
import type { FakeProperty } from './properties-of';

type Source = Readonly<Record<string, unknown>>;

export interface FakeDocument {
  readonly source: Source;
  readonly seqNo: number;
  readonly primaryTerm: number;
}

const LEAF_TYPES: Readonly<Record<string, (value: unknown) => boolean>> = {
  keyword: (value) => ['string', 'number', 'boolean'].includes(typeof value),
  double: (value) => typeof value === 'number',
  boolean: (value) => typeof value === 'boolean',
  date: (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value)),
};

/** One index of one shard: its strict mapping and its documents, each with its sequence number. */
export class FakeIndex {
  readonly documents = new Map<string, FakeDocument>();

  private sequence = -1;

  constructor(public properties: Readonly<Record<string, FakeProperty>>) {}

  /** Adds the fields a mapping lacks; a field mapped otherwise is refused, as the node does. */
  extend(properties: Readonly<Record<string, FakeProperty>>): void {
    this.properties = merged(this.properties, properties);
  }

  write(id: string, source: Source): FakeDocument {
    checked(source, this.properties, '_doc');
    this.sequence += 1;

    const document = { source: structuredClone(source), seqNo: this.sequence, primaryTerm: 1 };

    this.documents.set(id, document);

    return document;
  }
}

function merged(
  held: Readonly<Record<string, FakeProperty>>,
  added: Readonly<Record<string, FakeProperty>>,
): Readonly<Record<string, FakeProperty>> {
  const result: Record<string, FakeProperty> = { ...held };

  for (const [name, property] of Object.entries(added)) {
    const current = held[name];

    if (current === undefined) {
      result[name] = property;
    } else if ((current.type ?? 'object') !== (property.type ?? 'object')) {
      throw new FakeRefusal(
        400,
        'illegal_argument_exception',
        `mapper [${name}] cannot be changed from type [${String(current.type)}] to [${String(property.type)}]`,
      );
    } else if (current.properties !== undefined || property.properties !== undefined) {
      result[name] = { ...current, properties: merged(current.properties ?? {}, property.properties ?? {}) };
    }
  }

  return result;
}

function checked(source: Source, properties: Readonly<Record<string, FakeProperty>>, within: string): void {
  for (const [name, value] of Object.entries(source)) {
    const property = properties[name];

    if (property === undefined) {
      throw new FakeRefusal(
        400,
        'strict_dynamic_mapping_exception',
        `mapping set to strict, dynamic introduction of [${name}] within [${within}] is not allowed`,
      );
    }

    if (value === null || property.enabled === false) {
      continue;
    }

    if (property.properties !== undefined) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new FakeRefusal(400, 'mapper_parsing_exception', `object mapping for [${name}] tried to parse a value`);
      }

      checked(bodyOf(value), property.properties, name);
    } else if (!(LEAF_TYPES[property.type ?? 'keyword'] ?? (() => true))(value)) {
      throw new FakeRefusal(
        400,
        'mapper_parsing_exception',
        `failed to parse field [${name}] of type [${String(property.type)}]`,
      );
    }
  }
}
