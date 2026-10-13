import type { FileSource } from '../files/file-source.js';
import type { SignedDownload } from '../files/signed-download.js';
import type { StoredFile } from '../files/stored-file.js';
import { FileStorage } from './file-storage.js';

/**
 * A storage whose signed links point at the application itself, which must then answer them:
 * the local directory of development and the memory of the tests. `signedFileRoutes` of
 * `@ddd-ts-kit/http` mounts that answer. An object store answers its own links and is not one.
 */
export abstract class ServedFileStorage extends FileStorage {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.ServedFileStorage' });
  }

  /** The file a download link grants, or `undefined` for a link that is forged, expired or for another action. */
  abstract openSigned(token: string): Promise<SignedDownload | undefined>;

  /** Stores what an upload link grants, sent with the media type it was signed for; `undefined` when the link does not grant it. */
  abstract acceptSigned(token: string, content: FileSource, mediaType: string): Promise<StoredFile | undefined>;
}
