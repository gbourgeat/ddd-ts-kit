import type { ReceivedFile } from './received-file';
import type { StoredFile } from './stored-file';

/**
 * A file a command carries. The controller hands over the `ReceivedFile`, still streaming, and
 * the `fileUploadsMiddleware` of the bus stages it under a key of `area`, scanned, before the
 * unit of work opens: no transaction waits on a client that uploads slowly. The handler then
 * reads `file`, records it and asks `FileStaging.promoteOnCommit` for it.
 */
export class FileUpload {
  private stored: StoredFile | undefined;

  constructor(
    readonly received: ReceivedFile,
    /** A key prefix of the project, such as `appointment-documents`. */
    readonly area: string,
  ) {}

  /** The name the client gave: shown back to a person, never a key or a path. */
  get fileName(): string {
    return this.received.fileName;
  }

  get isStaged(): boolean {
    return this.stored !== undefined;
  }

  /** The staged file, under its final key. Read before the middleware staged it, a defect of the wiring. */
  get file(): StoredFile {
    if (this.stored === undefined) {
      throw new Error(
        `The file upload of area "${this.area}" was read before it was staged: install fileUploadsMiddleware on the command bus, before the unit of work.`,
      );
    }

    return this.stored;
  }

  /** Called by whoever staged it, once. */
  stagedAs(file: StoredFile): void {
    this.stored = file;
  }
}
