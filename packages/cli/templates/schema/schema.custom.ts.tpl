import { err, ok } from '@ddd-ts-kit/kernel';
import { customSchema, sharedSchema } from '@ddd-ts-kit/validation';

// TODO(domain): replace the object check by the schema of "{{name.words}}" written with the validation library of the project, wrapped as it is here, and describe its fields in the JSON Schema; the contract documents it once, as {{name.pascal}}.
export const {{name.camel}}Schema = sharedSchema(
  '{{name.pascal}}',
  customSchema<Record<string, unknown>>(
    (input) =>
      typeof input === 'object' && input !== null && !Array.isArray(input)
        ? ok({ ...input })
        : err([{ path: '', code: 'invalid_type', message: 'An object is expected.' }]),
    { type: 'object' },
  ),
);
