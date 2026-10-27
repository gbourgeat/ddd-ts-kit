import { PRISMA_SCHEMA_FOLDER } from './prisma-schema-folder';

/**
 * The models and enums of one bounded context, in a file of their own: the worker of the context
 * changes a column together with its mapper, on its own branch, and two workers never edit the
 * same file.
 */
export function prismaSchemaOf(context: string): string {
  return `${PRISMA_SCHEMA_FOLDER}/${context}.prisma`;
}
