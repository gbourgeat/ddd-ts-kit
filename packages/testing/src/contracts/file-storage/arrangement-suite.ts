import { PDF, TEXT } from './contents.js';
import { FileStorageSuite } from './file-storage-suite.js';

/** Files are copied, moved and listed by key, without reading them through the application. */
export class ArrangementSuite extends FileStorageSuite {
  protected tests(): void {
    this.copies();
    this.moves();
    this.lists();
  }

  private copies(): void {
    this.it('copies a file to another key, the original staying', async () => {
      await this.write('staging/documents/a.pdf', PDF);

      await this.subject.copy('staging/documents/a.pdf', 'documents/a.pdf');

      this.expect(await this.read('documents/a.pdf')).toEqual(PDF);
      this.expect(await this.read('staging/documents/a.pdf')).toEqual(PDF);
      this.expect((await this.subject.stat('documents/a.pdf'))?.mediaType).toBe('application/pdf');
    });

    this.it('refuses to copy a file that is not there', async () => {
      this.expect(await this.codeOf(() => this.subject.copy('documents/missing.pdf', 'documents/b.pdf'))).toBe(
        'FILE_NOT_FOUND',
      );
    });
  }

  private moves(): void {
    this.it('moves a file to another key, nothing staying behind', async () => {
      await this.write('staging/documents/a.txt', TEXT, 'text/plain');

      await this.subject.move('staging/documents/a.txt', 'documents/a.txt');

      this.expect(await this.read('documents/a.txt')).toEqual(TEXT);
      this.expect((await this.subject.stat('documents/a.txt'))?.mediaType).toBe('text/plain');
      this.expect(await this.subject.stat('staging/documents/a.txt')).toBe(undefined);
    });

    this.it('refuses to move a file that is not there', async () => {
      this.expect(await this.codeOf(() => this.subject.move('documents/missing.pdf', 'documents/b.pdf'))).toBe(
        'FILE_NOT_FOUND',
      );
    });
  }

  private lists(): void {
    this.it('lists the files under a prefix, nested ones included, and no other', async () => {
      await this.write('staging/a.pdf', PDF);
      await this.write('staging/deep/er/b.pdf', TEXT);
      await this.write('documents/c.pdf', PDF);

      const listed = [];

      for await (const file of this.subject.list('staging/')) {
        listed.push([file.key, file.size, file.lastModified instanceof Date]);
      }

      listed.sort((left, right) => String(left[0]).localeCompare(String(right[0])));

      this.expect(listed).toEqual([
        ['staging/a.pdf', PDF.length, true],
        ['staging/deep/er/b.pdf', TEXT.length, true],
      ]);
    });
  }
}
