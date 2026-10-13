import { ValidationError } from '@ddd-ts-kit/validation';

/** A request body that cannot be read in its media type: answered as an invalid request, without quoting it. */
export function malformedBody(mediaType: string): ValidationError {
  return new ValidationError(
    [{ path: 'body', code: 'malformed', message: `The body is not well-formed ${mediaType}.` }],
    'The request is not valid.',
  );
}
