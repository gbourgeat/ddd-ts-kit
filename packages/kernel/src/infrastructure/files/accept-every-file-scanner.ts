import type { ScanVerdict } from '../../application/files/scan-verdict';
import type { FileScanner } from '../../application/ports/file-scanner';

/** The scanner of a project that has none yet: accepts every file without reading it. Bind a real one before accepting files from strangers. */
export class AcceptEveryFileScanner implements FileScanner {
  scan(): Promise<ScanVerdict> {
    return Promise.resolve({ accepted: true });
  }
}
