import type { ContextFacts } from './context-facts';

/** The line width of the formatter of a generated project (`biome.json`, `lineWidth`). */
const WIDTH = 120;

/** The indentation of the fields of one entry, inside the list and its `personal` object. */
const FIELDS_INDENT = '    ';

/**
 * The entries of `personal-events.ts`, as the formatter of a generated project keeps them: one
 * object per event, sorted by type and version, its fields on one line while they fit.
 */
export function personalEventLines(contexts: readonly Pick<ContextFacts, 'publishedEvents'>[]): string[] {
  return contexts
    .flatMap((context) => context.publishedEvents)
    .sort((left, right) => left.type.localeCompare(right.type) || left.version - right.version)
    .flatMap(({ type, version, personal }) =>
      personal === undefined
        ? []
        : [
            '{',
            `  type: '${type}',`,
            `  version: ${String(version)},`,
            '  personal: {',
            `    subject: '${personal.subject}',`,
            ...fieldLines(personal.fields),
            '  },',
            '},',
          ],
    );
}

function fieldLines(fields: readonly string[]): string[] {
  const quoted = fields.map((field) => `'${field}'`);
  const line = `    fields: [${quoted.join(', ')}],`;

  if (FIELDS_INDENT.length + line.length <= WIDTH) {
    return [line];
  }

  return ['    fields: [', ...quoted.map((field) => `      ${field},`), '    ],'];
}
