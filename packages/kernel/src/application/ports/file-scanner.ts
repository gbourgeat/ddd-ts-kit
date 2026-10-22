import type { Readable } from 'node:stream';
import type { ScanVerdict } from '../files/scan-verdict';
import type { StoredFile } from '../files/stored-file';

/**
 * The check a file passes before it is accepted: an antivirus (ClamAV over its socket, a cloud
 * scanning service), a parser that refuses a malformed document, a policy on archives. Called on
 * the staged file, so a refused file is never visible. `open` reads the content again; a scanner
 * that needs none of it does not call it.
 */
export abstract class FileScanner {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.FileScanner' });
  }

  abstract scan(file: StoredFile, open: () => Promise<Readable>): Promise<ScanVerdict>;
}
