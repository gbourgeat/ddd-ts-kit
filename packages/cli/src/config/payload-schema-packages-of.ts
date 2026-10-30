import { schemaLibrariesOf } from './schema-libraries-of';

/**
 * What the file of a background job (`application/background/*.background-job.ts`) imports past
 * the application layer, for the schema of its payload: `@ddd-ts-kit/validation` and the library
 * of the stack, no other one.
 */
export function payloadSchemaPackagesOf(validation: string): readonly string[] {
  return ['@ddd-ts-kit/validation', ...schemaLibrariesOf(validation)];
}
