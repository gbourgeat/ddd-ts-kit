import { FileError } from './file-error';
import { MAX_SIGNED_URL_SECONDS } from './max-signed-url-seconds';

/** For a connector: the lifetime of a signed link, refused when it is not a whole number of seconds up to the maximum. */
export function assertExpiry(seconds: number): number {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_SIGNED_URL_SECONDS) {
    throw FileError.invalidExpiry(seconds);
  }

  return seconds;
}
