import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { errorReportOf } from '../../application/error-reporting/error-report-of.js';
import { reportOnce } from '../../application/error-reporting/report-once.js';
import type { ConfirmOptions } from '../../application/files/confirm-options.js';
import { FileError } from '../../application/files/file-error.js';
import type { FileSource } from '../../application/files/file-source.js';
import { mediaTypeOf } from '../../application/files/media-type-of.js';
import type { PutOptions } from '../../application/files/put-options.js';
import type { SignedUpload } from '../../application/files/signed-upload.js';
import { STAGING_PREFIX, stagedKeyOf } from '../../application/files/staged-key-of.js';
import type { StoredFile } from '../../application/files/stored-file.js';
import type { UploadUrlOptions } from '../../application/files/upload-url-options.js';
import type { ErrorReporter } from '../../application/ports/error-reporter.js';
import type { FileScanner } from '../../application/ports/file-scanner.js';
import type { FileStorage } from '../../application/ports/file-storage.js';
import { afterCommit } from '../domain-events/after-commit.js';
import { FileInspection } from './file-inspection.js';

/**
 * Keeps the storage consistent with the database, which a write to the storage cannot join in a
 * transaction. A handler stages the file (under `staging/`, scanned, invisible), records its
 * reference in the aggregate it saves, and asks for the promotion after the commit: a command
 * that rolls back leaves its file in `staging/` only, where nothing reads, and `purge` removes it
 * on a schedule. The aggregate holds the final key from the start.
 */
export class FileStaging {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.FileStaging' });
  }

  constructor(
    private readonly storage: FileStorage,
    private readonly scanner: FileScanner,
    private readonly reporter: ErrorReporter,
  ) {}

  /** Writes the content under the staged key, then has it scanned; a refused file is removed and `FILE_REJECTED` thrown. */
  async stage(key: string, content: FileSource, options: PutOptions): Promise<StoredFile> {
    const staged = await this.storage.put(stagedKeyOf(key), content, options);

    return this.scanned({ ...staged, key });
  }

  /** A request the client sends the file with, straight to the staged key; `confirm` then checks what arrived. */
  uploadUrl(key: string, options: UploadUrlOptions): Promise<SignedUpload> {
    return this.storage.signedUploadUrl(stagedKeyOf(key), options);
  }

  /** Reads a file uploaded straight to the staged key: its size, its media type on its bytes, its checksum, the scan. */
  async confirm(key: string, options: ConfirmOptions): Promise<StoredFile> {
    const content = await this.storage.get(stagedKeyOf(key));

    if (content === undefined) {
      throw FileError.notFound(key);
    }

    const { maxBytes, mediaType, accepted } = options;

    const inspection = new FileInspection({
      ...(maxBytes === undefined ? {} : { maxBytes }),
      expected: { mediaType, accepted },
    });

    await pipeline(content.stream, inspection, sink()).catch(async (error: unknown) => {
      await this.discard(key);
      throw error;
    });

    return this.scanned({
      key,
      size: inspection.size,
      mediaType: mediaTypeOf(mediaType),
      checksum: inspection.checksum,
    });
  }

  /** Promotes the staged file once the unit of work in progress has committed; a failure is reported, the staged file stays for the purge. */
  promoteAfterCommit(key: string): Promise<void> {
    return afterCommit(async () => {
      await this.promote(key).catch((error: unknown) => {
        reportOnce(this.reporter, error, errorReportOf(error, { origin: 'process', operation: 'promote staged file' }));
      });
    });
  }

  /** Moves the staged file to its key. Promoting twice is not an error; a key staged nowhere and stored nowhere is `FILE_NOT_FOUND`. */
  async promote(key: string): Promise<void> {
    if ((await this.storage.stat(stagedKeyOf(key))) !== undefined) {
      await this.storage.move(stagedKeyOf(key), key);

      return;
    }

    if ((await this.storage.stat(key)) === undefined) {
      throw FileError.notFound(key);
    }
  }

  discard(key: string): Promise<void> {
    return this.storage.delete(stagedKeyOf(key));
  }

  /** Removes the staged files older than the instant, those of the commands that rolled back or crashed; answers how many. */
  async purge(olderThan: Date): Promise<number> {
    let purged = 0;

    for await (const file of this.storage.list(STAGING_PREFIX)) {
      if (file.lastModified < olderThan) {
        await this.storage.delete(file.key);
        purged += 1;
      }
    }

    return purged;
  }

  private async scanned(file: StoredFile): Promise<StoredFile> {
    const verdict = await this.scanner.scan(file, async () => {
      const content = await this.storage.get(stagedKeyOf(file.key));

      if (content === undefined) {
        throw FileError.notFound(file.key);
      }

      return content.stream;
    });

    if (!verdict.accepted) {
      await this.discard(file.key);
      throw FileError.rejected(file.key, verdict.reason);
    }

    return file;
  }
}

function sink(): Writable {
  return new Writable({ write: (_chunk, _encoding, done) => done() });
}
