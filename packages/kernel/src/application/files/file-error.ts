import { ConceptError } from '../../domain/errors/concept-error';
import { MAX_SIGNED_URL_SECONDS } from './max-signed-url-seconds';

/**
 * The refusals of a file. `FILE_TOO_LARGE` and `UNSUPPORTED_MEDIA_TYPE` are answered 413 and 415
 * by `@ddd-ts-kit/http`; the key itself never leaves the process.
 */
export class FileError extends ConceptError {
  static tooLarge(maxBytes: number) {
    return FileError.refusal('FILE_TOO_LARGE', `The file is larger than ${String(maxBytes)} bytes.`, {
      maxBytes,
    }).exposing('maxBytes');
  }

  static unsupportedMediaType(mediaType: string, accepted: readonly string[]) {
    return FileError.refusal(
      'UNSUPPORTED_MEDIA_TYPE',
      `The content is not one of ${accepted.join(', ')} (declared ${mediaType}).`,
      { mediaType, accepted: accepted.join(',') },
    ).exposing('accepted');
  }

  static notFound(key: string) {
    return FileError.refusal('FILE_NOT_FOUND', 'No file is stored under this key.', { key });
  }

  static invalidKey(key: string) {
    return FileError.refusal(
      'INVALID_FILE_KEY',
      'A file key is made of segments of letters, digits, dots, hyphens and underscores, none starting with a dot.',
      { key },
    );
  }

  static rejected(key: string, reason: string) {
    return FileError.refusal('FILE_REJECTED', `The content was refused: ${reason}.`, { key, reason });
  }

  static invalidExpiry(seconds: number) {
    return FileError.refusal(
      'INVALID_FILE_URL_EXPIRY',
      `A signed link lives between 1 and ${String(MAX_SIGNED_URL_SECONDS)} seconds, not ${String(seconds)}.`,
      { seconds },
    );
  }
}
