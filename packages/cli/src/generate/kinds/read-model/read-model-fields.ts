import { CliError } from '../../../cli-error';
import { toName } from '../../../naming';

/** How the values of a field compare, as the criteria of the kernel name it. */
const FIELD_TYPES = ['string', 'number', 'boolean', 'instant', 'decimal'] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** One field of the row of a read model, beside its key. */
export interface ReadModelField {
  /** The property of the row, in camelCase. */
  readonly name: string;
  /** Its column, in snake_case. */
  readonly column: string;
  readonly type: FieldType;
  readonly nullable: boolean;
}

const FORMAT = `--field <name>:<${FIELD_TYPES.join('|')}>[:nullable]`;

/** What the store keeps beside the fields of the row: the key, the stamp of the last event, the tenant. */
const KEPT_BY_THE_STORE = ['id', 'tenantId', 'lastEventId', 'lastEventAt', 'lastEventVersion', 'deleted'];

/**
 * The `--field <name>:<type>[:nullable]` flags of `generate read-model`, as the fields of its row: a name
 * in camelCase, a type of the criteria of the kernel, `:nullable` for a field that may hold null.
 */
export function readModelFields(flags: readonly string[]): ReadModelField[] {
  const fields = flags.map(fieldOf);
  const twice = fields.find((field, index) => fields.findIndex(({ name }) => name === field.name) < index);

  if (twice !== undefined) {
    throw new CliError(`--field names "${twice.name}" twice.`, 'A row holds a field once: name it in one --field.');
  }

  return fields;
}

function fieldOf(flag: string): ReadModelField {
  const [, name, type, optional] = /^([a-z][A-Za-z0-9]*):([a-z]+)(:nullable)?$/.exec(flag.trim()) ?? [];
  const known = FIELD_TYPES.find((candidate) => candidate === type);

  if (name === undefined || known === undefined) {
    throw new CliError(
      `--field "${flag}" is not a field with its type.`,
      `Write it as ${FORMAT}, the name in camelCase, for example --field startsAt:instant --field room:string:nullable.`,
    );
  }

  if (KEPT_BY_THE_STORE.includes(name)) {
    throw new CliError(
      `--field "${flag}" names "${name}", which the read model already holds.`,
      'The key of a row is `id`, and the store keeps the tenant, the stamp of the last event and the trace of a deletion itself: name the fields of the row only.',
    );
  }

  return { name, column: toName(name).kebab.replaceAll('-', '_'), type: known, nullable: optional !== undefined };
}
