import { ValidationError } from '@ddd-ts-kit/validation';

/** The refusal of a multipart request without the file its route declares. */
export function missingFile(field: string): ValidationError {
  return new ValidationError(
    [{ path: `body.${field}`, code: 'required', message: `A file is expected in the field "${field}".` }],
    'The request is not valid.',
  );
}
