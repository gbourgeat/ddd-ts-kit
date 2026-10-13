import { DomainError } from '@ddd-ts-kit/kernel';

export const UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE';

/** The body of the request is in a media type the route does not read: 415. */
export class UnsupportedMediaTypeError extends DomainError {
  readonly code = UNSUPPORTED_MEDIA_TYPE;
}
