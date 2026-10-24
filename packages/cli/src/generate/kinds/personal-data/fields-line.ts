import { fitStatement } from '../../../layout';

/** The `fields` property of a declaration, laid out as the formatter would: one line while it fits, one name per line beyond. */
export function fieldsLine(names: readonly string[]): string {
  const quoted = names.map((name) => `'${name}'`).join(', ');

  return fitStatement(`fields: [${quoted}],`, '  ').join('\n');
}
