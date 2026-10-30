import type { Name } from '../../../naming';
import type { PayloadField } from './payload-field';

/** What the schema of a payload says around its fields. */
export const payloadTexts = {
  /** Above the type of the payload. */
  typeComment: (name: Name): string =>
    `/** What "${name.words}" works on, as plain JSON: a date travels as its ISO text. */`,

  /** In the schema of a payload the generator knows no field of. */
  emptyTodo: (name: Name): string =>
    `// TODO(domain): declare what "${name.words}" works on (identifiers, a period, never an aggregate), as plain JSON: a date travels as its ISO text.`,

  /** Above a field whose type the generator writes no check for. */
  unreadTodo: (field: PayloadField, type: string): string =>
    `// TODO(domain): check \`${field.name}\` (${type}) in the schema: the payload a queue kept is read with it before each run.`,
};
