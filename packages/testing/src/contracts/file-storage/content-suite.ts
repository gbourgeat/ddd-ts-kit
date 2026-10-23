import { checksumOf } from './checksum-of';
import { chunksOf } from './chunks-of';
import { LARGE_SIZE, PDF, TEXT } from './contents';
import { largeContent } from './large-content';
import { FileStorageSuite } from './file-storage-suite';

const INVALID_KEYS = ['', '../escape', '/absolute', 'a//b', '.hidden', 'a/../b', 'a/./b', 'with space', 'tail/'];

/** Content goes in and out as streams, intact, measured and refused beyond its limit; keys stay inside the storage. */
export class ContentSuite extends FileStorageSuite {
  protected tests(): void {
    this.roundTrips();
    this.streamsLarge();
    this.overwrites();
    this.limits();
    this.keys();
    this.removes();
  }

  private roundTrips(): void {
    this.it('gives back what was written, with its size, media type and checksum', async () => {
      const stored = await this.subject.put('documents/report.pdf', chunksOf(PDF), { mediaType: 'Application/PDF' });
      const metadata = await this.subject.stat('documents/report.pdf');
      const checksum = await checksumOf([PDF]);

      this.expect(stored).toEqual({
        key: 'documents/report.pdf',
        size: PDF.length,
        mediaType: 'application/pdf',
        checksum,
      });

      this.expect(await this.read('documents/report.pdf')).toEqual(PDF);

      this.expect([metadata?.key, metadata?.size, metadata?.mediaType]).toEqual([
        'documents/report.pdf',
        PDF.length,
        'application/pdf',
      ]);

      this.expect(metadata?.checksum === undefined || metadata.checksum === checksum).toBe(true);
      this.expect(metadata?.lastModified instanceof Date).toBe(true);
    });
  }

  private streamsLarge(): void {
    this.it('streams a content of several mebibytes, chunk after chunk', async () => {
      const stored = await this.subject.put('exports/large.bin', largeContent(), {
        mediaType: 'application/octet-stream',
      });

      const content = await this.subject.get('exports/large.bin');
      let read = 0;

      for await (const chunk of content?.stream ?? []) {
        read += Buffer.byteLength(chunk instanceof Uint8Array ? chunk : String(chunk));
      }

      this.expect([stored.size, stored.checksum, read]).toEqual([
        LARGE_SIZE,
        await checksumOf(largeContent()),
        LARGE_SIZE,
      ]);
    });
  }

  private overwrites(): void {
    this.it('replaces the content written again under a key', async () => {
      await this.write('notes/today.txt', PDF);
      await this.write('notes/today.txt', TEXT, 'text/plain');

      this.expect(await this.read('notes/today.txt')).toEqual(TEXT);
      this.expect((await this.subject.stat('notes/today.txt'))?.mediaType).toBe('text/plain');
    });

    this.it('answers undefined for a key nothing is stored under', async () => {
      this.expect(await this.subject.get('documents/missing.pdf')).toBe(undefined);
      this.expect(await this.subject.stat('documents/missing.pdf')).toBe(undefined);
    });
  }

  private limits(): void {
    this.it('refuses a content beyond its limit, and leaves what the key held before', async () => {
      await this.write('documents/report.pdf', TEXT, 'text/plain');

      const code = await this.codeOf(() =>
        this.subject.put('documents/report.pdf', largeContent(), { mediaType: 'application/pdf', maxBytes: 1_000_000 }),
      );

      this.expect(code).toBe('FILE_TOO_LARGE');
      this.expect(await this.read('documents/report.pdf')).toEqual(TEXT);
    });

    this.it('leaves nothing under a new key whose content was refused', async () => {
      const code = await this.codeOf(() =>
        this.subject.put('documents/new.pdf', chunksOf(PDF), { mediaType: 'application/pdf', maxBytes: 10 }),
      );

      this.expect(code).toBe('FILE_TOO_LARGE');
      this.expect(await this.subject.stat('documents/new.pdf')).toBe(undefined);
    });

    this.it('accepts a content of exactly its limit', async () => {
      const stored = await this.subject.put('documents/exact.pdf', chunksOf(PDF), {
        mediaType: 'application/pdf',
        maxBytes: PDF.length,
      });

      this.expect(stored.size).toBe(PDF.length);
    });
  }

  private keys(): void {
    this.it('refuses a key that could leave its place, before touching anything', async () => {
      for (const key of INVALID_KEYS) {
        this.expect(await this.codeOf(() => this.write(key, PDF))).toBe('INVALID_FILE_KEY');
        this.expect(await this.codeOf(() => this.subject.get(key))).toBe('INVALID_FILE_KEY');
        this.expect(await this.codeOf(() => this.subject.stat(key))).toBe('INVALID_FILE_KEY');
        this.expect(await this.codeOf(() => this.subject.delete(key))).toBe('INVALID_FILE_KEY');
      }
    });
  }

  private removes(): void {
    this.it('forgets a deleted file, and only that one', async () => {
      await this.write('documents/a.pdf', PDF);
      await this.write('documents/b.pdf', PDF);

      await this.subject.delete('documents/a.pdf');

      this.expect(await this.subject.stat('documents/a.pdf')).toBe(undefined);
      this.expect(await this.read('documents/b.pdf')).toEqual(PDF);
    });

    this.it('accepts the deletion of a file that is not there', async () => {
      this.expect(await this.codeOf(() => this.subject.delete('documents/missing.pdf'))).toBe('resolved');
    });
  }
}
