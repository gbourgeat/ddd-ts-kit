import type { EventStamp, FieldDeclaration, FieldType, FieldValue } from '@ddd-ts-kit/kernel';
import { isJsonObject } from '../store/is-json-object';
import { decimalKey } from './decimal-key';
import { mappingOf } from './mapping-of';
import { RESERVED, RESERVED_PREFIX } from './reserved-fields';
import type { StoredField } from './stored-field';

type Source = Readonly<Record<string, unknown>>;

/**
 * The fields of one read model as the index holds them: the fields of its criteria definition,
 * which a read filters and sorts by, the other fields of the row, kept and not indexed, and the
 * tenant of each document. It writes a row as a document, reads it back, and names the field and
 * the value a query compares.
 */
export class DocumentMapper<Row> {
  private readonly fields: ReadonlyMap<string, StoredField>;

  constructor(
    declared: Readonly<Record<string, FieldDeclaration>>,
    stored: Readonly<Record<string, FieldType | undefined>>,
    readonly tenantField: string | undefined,
  ) {
    this.fields = storedFieldsOf(declared, stored);

    for (const name of [...this.fields.keys(), ...(tenantField === undefined ? [] : [tenantField])]) {
      assertWritable(name);
    }

    const tenantType = tenantField === undefined ? 'string' : (this.fields.get(tenantField)?.type ?? 'string');

    if (tenantType !== 'string') {
      throw new TypeError(
        `The tenant field "${String(tenantField)}" of a read model holds a string, not a ${tenantType}`,
      );
    }
  }

  mapping(): Source {
    return mappingOf(this.fields, this.tenantField);
  }

  /** The document of a row, or of the trace of a deleted one when `row` is `undefined`. */
  documentOf(row: Row | undefined, stamp: EventStamp, tenant: string | undefined): Record<string, unknown> {
    const document: Record<string, unknown> = {};
    const order: Record<string, string | null> = {};

    for (const [name, value] of Object.entries(row ?? {})) {
      const field = this.fields.get(name);

      document[name] = value instanceof Date ? value.toISOString() : value;

      if (field?.indexed === true && field.type === 'decimal') {
        order[name] = value === null ? null : decimalKey(typeof value === 'string' ? value : JSON.stringify(value));
      }
    }

    return {
      ...document,
      ...(this.tenantField === undefined ? {} : { [this.tenantField]: tenant }),
      [RESERVED.stamp]: { ...stamp, occurredAt: stamp.occurredAt.toISOString() },
      [RESERVED.deleted]: row === undefined,
      [RESERVED.order]: order,
    };
  }

  /** The row a document holds: its declared fields, instants as `Date`, the tenant only when the row declares it. */
  rowOf(source: Source): Row {
    const row: Record<string, unknown> = {};

    for (const [name, field] of this.fields) {
      if (Object.hasOwn(source, name)) {
        const value = source[name];

        row[name] = field.type === 'instant' && typeof value === 'string' ? new Date(value) : value;
      }
    }

    // The document was written by `documentOf` from a row, under a strict mapping of its fields.
    return row as Row;
  }

  stampOf(source: Source): EventStamp {
    const written = source[RESERVED.stamp];
    const stamp: Source = isJsonObject(written) ? written : {};
    const { version } = stamp;

    return {
      eventId: String(stamp['eventId']),
      occurredAt: new Date(String(stamp['occurredAt'])),
      ...(typeof version === 'number' ? { version } : {}),
    };
  }

  /** The field a query compares: the order key of a decimal, the field itself otherwise. */
  pathOf(name: string): string {
    return this.fields.get(name)?.type === 'decimal' ? `${RESERVED.order}.${name}` : name;
  }

  /** A value of a query as the index compares it. */
  operandOf(name: string, value: FieldValue): string | number | boolean {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return this.fields.get(name)?.type === 'decimal' ? decimalKey(String(value)) : value;
  }
}

/** The fields of the definition, indexed, over the other fields of the row, kept only. */
function storedFieldsOf(
  declared: Readonly<Record<string, FieldDeclaration>>,
  stored: Readonly<Record<string, FieldType | undefined>>,
): ReadonlyMap<string, StoredField> {
  const kept = Object.entries(stored).flatMap(([name, type]) =>
    type === undefined ? [] : [[name, { type, indexed: false }] as const],
  );

  return new Map<string, StoredField>([
    ...kept,
    ...Object.entries(declared).map(([name, { type }]) => [name, { type, indexed: true }] as const),
  ]);
}

function assertWritable(name: string): void {
  if (name.startsWith(RESERVED_PREFIX) || name.includes('.') || name === '') {
    throw new TypeError(
      `The field "${name}" cannot be held by an OpenSearch read model: a dot reads as a path, and "${RESERVED_PREFIX}" starts the fields of the store`,
    );
  }
}
