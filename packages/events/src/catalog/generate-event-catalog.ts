import type { AnyIntegrationEventDefinition } from '../definition/any-integration-event-definition';
import { compareText } from '../internal/json-schema/compare-text';
import type { EventRegistry } from '../registry/event-registry';
import type { PayloadField } from './payload-field';
import { payloadFields } from './payload-fields';

export interface EventCatalogOptions {
  readonly title?: string;
  /** Consuming contexts by event type. Declared by hand: a producer does not know them. */
  readonly consumers?: Readonly<Record<string, readonly string[]>>;
}

/**
 * A Markdown catalog of every declared event, grouped by producer context. Deterministic:
 * commit the file and let CI fail when the regenerated content differs.
 */
export function generateEventCatalog(registry: EventRegistry, options: EventCatalogOptions = {}): string {
  const definitions = registry.all();

  const producers = [...new Set(definitions.map((definition) => definition.producer))].sort(compareText);

  const lines = [
    `# ${options.title ?? 'Event catalog'}`,
    '',
    'Generated from the integration event declarations. Do not edit by hand: regenerate.',
    ...producers.flatMap((producer) =>
      producerSection(
        producer,
        definitions.filter((definition) => definition.producer === producer),
        options,
      ),
    ),
  ];

  return `${lines.join('\n')}\n`;
}

function producerSection(
  producer: string,
  owned: readonly AnyIntegrationEventDefinition[],
  options: EventCatalogOptions,
): string[] {
  const types = [...new Set(owned.map((definition) => definition.type))];

  return [
    '',
    `## ${producer}`,
    ...types.flatMap((type) =>
      eventSection(
        type,
        owned.filter((definition) => definition.type === type),
        options.consumers?.[type] ?? [],
      ),
    ),
  ];
}

function eventSection(
  type: string,
  versions: readonly AnyIntegrationEventDefinition[],
  consumers: readonly string[],
): string[] {
  const names = [...consumers].sort(compareText);

  return [
    '',
    `### ${type}`,
    '',
    ...versionsTable(versions),
    ...(names.length === 0 ? [] : ['', `Consumers: ${names.map((name) => `\`${name}\``).join(', ')}`]),
    ...versions.flatMap((definition) => [
      '',
      `#### Payload of version ${definition.version}`,
      '',
      ...payloadTable(payloadFields(definition.payload.toJsonSchema())),
      ...personalLine(definition),
    ]),
  ];
}

/** Says which fields carry personal data, and whose: a consumer that copies one keeps a copy of the person. */
function personalLine({ personal }: AnyIntegrationEventDefinition): string[] {
  if (personal === undefined) {
    return [];
  }

  const fields = personal.fields.map((field) => `\`${field}\``).join(', ');

  return [
    '',
    `Personal data: ${fields}, about the data subject named by \`${personal.subject}\`. A consumer that keeps a copy declares it with \`personalFields\` and erases it on \`privacy.data-subject.erased\`.`,
  ];
}

function versionsTable(versions: readonly AnyIntegrationEventDefinition[]): string[] {
  return table(
    ['Type', 'Version', 'Description', 'Deprecated'],
    versions.map((definition) => [
      `\`${definition.type}\``,
      String(definition.version),
      definition.description ?? '',
      definition.deprecated ? 'yes' : 'no',
    ]),
  );
}

function payloadTable(fields: readonly PayloadField[]): string[] {
  if (fields.length === 0) {
    return ['No documented field.'];
  }

  return table(
    ['Field', 'Type', 'Required', 'Description'],
    fields.map((field) => [`\`${field.path}\``, field.type, field.required ? 'yes' : 'no', field.description]),
  );
}

function table(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  const line = (cells: readonly string[]): string => `| ${cells.map(escapeCell).join(' | ')} |`;

  return [line(header), line(header.map(() => '---')), ...rows.map(line)];
}

function escapeCell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll(/\s*\n\s*/g, ' ');
}
