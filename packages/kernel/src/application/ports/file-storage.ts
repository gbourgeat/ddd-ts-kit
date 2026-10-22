import type { DownloadUrlOptions } from '../files/download-url-options';
import type { FileContent } from '../files/file-content';
import type { FileMetadata } from '../files/file-metadata';
import type { FileSource } from '../files/file-source';
import type { ListedFile } from '../files/listed-file';
import type { PutOptions } from '../files/put-options';
import type { SignedUpload } from '../files/signed-upload';
import type { SignedUrl } from '../files/signed-url';
import type { StoredFile } from '../files/stored-file';
import type { UploadUrlOptions } from '../files/upload-url-options';

/**
 * Where the content of files lives: an object store, a directory, the memory of a test. Never
 * the database, whose backups, replicas and memory are sized for rows. Content always streams in
 * and out: no method takes or returns a whole file. A key that `isFileKey` refuses is refused
 * with `INVALID_FILE_KEY` before anything is touched.
 *
 * A write is not part of a transaction: see `FileStaging` for the order that keeps the database
 * and the storage consistent.
 */
export abstract class FileStorage {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.FileStorage' });
  }

  /** Writes the content under the key, replacing what was there; rejects with `FILE_TOO_LARGE` beyond `maxBytes`, leaving nothing. */
  abstract put(key: string, content: FileSource, options: PutOptions): Promise<StoredFile>;

  /** The content as a stream, or `undefined` when nothing is stored under the key. */
  abstract get(key: string): Promise<FileContent | undefined>;

  /** What is known of the file without reading it, or `undefined`: how a caller asks whether it exists. */
  abstract stat(key: string): Promise<FileMetadata | undefined>;

  /** Removes the file; removing a file that is not there is not an error. */
  abstract delete(key: string): Promise<void>;

  /** Rejects with `FILE_NOT_FOUND` when nothing is stored under `from`. */
  abstract copy(from: string, to: string): Promise<void>;

  /** Rejects with `FILE_NOT_FOUND` when nothing is stored under `from`. */
  abstract move(from: string, to: string): Promise<void>;

  /** Every file whose key starts with the prefix, in no promised order. */
  abstract list(prefix: string): AsyncIterable<ListedFile>;

  /** A link that downloads the file until it expires. Signing does not check that the file exists. */
  abstract signedDownloadUrl(key: string, options: DownloadUrlOptions): Promise<SignedUrl>;

  /** A request that uploads one file under the key, straight to the storage, until it expires. */
  abstract signedUploadUrl(key: string, options: UploadUrlOptions): Promise<SignedUpload>;
}
