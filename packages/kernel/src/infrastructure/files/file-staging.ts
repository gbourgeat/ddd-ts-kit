import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { errorReportOf } from '../../application/error-reporting/error-report-of.js';
import { reportOnce } from '../../application/error-reporting/report-once.js';
import { assertFinalKey } from '../../application/files/assert-final-key.js';
import type { ContentExpectation } from '../../application/files/content-expectation.js';
import { FileError } from '../../application/files/file-error.js';
import type { FileSource } from '../../application/files/file-source.js';
import { mediaTypeOf } from '../../application/files/media-type-of.js';
import type { PendingUpload } from '../../application/files/pending-upload.js';
import type { PendingUploadLink } from '../../application/files/pending-upload-link.js';
import type { PutOptions } from '../../application/files/put-options.js';
import { STAGING_PREFIX, stagedKeyOf } from '../../application/files/staged-key-of.js';
import type { StoredFile } from '../../application/files/stored-file.js';
import type { UploadUrlOptions } from '../../application/files/upload-url-options.js';
import type { ErrorReporter } from '../../application/ports/error-reporter.js';
import type { FileScanner } from '../../application/ports/file-scanner.js';
import type { FileStorage } from '../../application/ports/file-storage.js';
import { afterCommit } from '../domain-events/after-commit.js';
import { atCommit } from '../domain-events/at-commit.js';
import { FileInspection } from './file-inspection.js';

/**
 * Keeps the storage consistent with the database, which a write to the storage cannot join in a
 * transaction. A file is staged first (under `staging/`, scanned, where nothing reads), before
 * the unit of work opens when it comes from a client. The handler records its reference, under
 * its final key, in the aggregate it saves, and asks for `promoteOnCommit`: the file moves to its
 * key as the last step of the transaction, and back to `staging/` if the transaction rolls back.
 * So a committed row never points into `staging/`, and every staged file is an orphan (a refused
 * command, a rollback, an upload never confirmed) that `purge` removes on a schedule.
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
    const staged = await this.storage.put(stagedKeyOf(assertFinalKey(key)), content, options);

    return this.scanned({ ...staged, key });
  }

  /**
   * A request the client sends the file with, straight to the staged key, and the grant to keep
   * on the server (on the aggregate that awaits the file) for `confirm` to read back.
   */
  async uploadUrl(
    key: string,
    options: UploadUrlOptions & Pick<ContentExpectation, 'accepted'>,
  ): Promise<PendingUploadLink> {
    const { expiresInSeconds, mediaType, maxBytes, accepted } = options;

    const link = await this.storage.signedUploadUrl(stagedKeyOf(assertFinalKey(key)), {
      expiresInSeconds,
      mediaType,
      maxBytes,
    });

    return { link, pending: { key, mediaType: mediaTypeOf(mediaType), accepted, maxBytes } };
  }

  /**
   * Reads a file uploaded straight to the staged key of a grant the server kept: its size against
   * the cap of the grant, its media type on its bytes, its checksum, the scan. A file that fails
   * is discarded.
   */
  async confirm(pending: PendingUpload): Promise<StoredFile> {
    const { key, maxBytes, mediaType, accepted } = pending;
    const content = await this.storage.get(stagedKeyOf(assertFinalKey(key)));

    if (content === undefined) {
      throw FileError.notFound(key);
    }

    const inspection = new FileInspection({ maxBytes, expected: { mediaType, accepted } });

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

  /**
   * Moves the staged file to its key as the last step of the unit of work in progress, so that
   * the commit and the file land together: a promotion that fails rolls the command back, and a
   * transaction that rolls back after it returns the file to `staging/`. At once outside of any.
   */
  promoteOnCommit(key: string): Promise<void> {
    return atCommit({ apply: () => this.promote(key), undo: () => this.returnToStaging(key) });
  }

  /** Moves the staged file to its key. Promoting twice is not an error; a key staged nowhere and stored nowhere is `FILE_NOT_FOUND`. */
  async promote(key: string): Promise<void> {
    if ((await this.storage.stat(stagedKeyOf(assertFinalKey(key)))) !== undefined) {
      await this.storage.move(stagedKeyOf(key), key);

      return;
    }

    if ((await this.storage.stat(key)) === undefined) {
      throw FileError.notFound(key);
    }
  }

  /** Deletes a stored file once the unit of work in progress has committed, the one its aggregate no longer references; a failure is reported. */
  deleteAfterCommit(key: string): Promise<void> {
    return afterCommit(async () => {
      await this.storage.delete(key).catch((error: unknown) => {
        reportOnce(this.reporter, error, errorReportOf(error, { origin: 'process', operation: 'delete stored file' }));
      });
    });
  }

  /** Removes a staged file, one a command will not record. */
  discard(key: string): Promise<void> {
    return this.storage.delete(stagedKeyOf(key));
  }

  /**
   * Removes the staged files older than the instant; answers how many. Each is an orphan: no
   * committed row points into `staging/`, since a promotion lands with its commit.
   */
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

  /** A transaction rolled back after the promotion: the file goes back where the purge finds it; a failure is reported. */
  private async returnToStaging(key: string): Promise<void> {
    await this.storage.move(key, stagedKeyOf(key)).catch((error: unknown) => {
      reportOnce(
        this.reporter,
        error,
        errorReportOf(error, { origin: 'process', operation: 'return file to staging' }),
      );
    });
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
