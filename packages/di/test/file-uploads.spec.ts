import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  AcceptEveryFileScanner,
  Clock,
  Command,
  ErrorReporter,
  FileKeys,
  FileStaging,
  FileUpload,
  IdGenerator,
  InMemoryFileStorage,
  TenantFileKeys,
  type StoredFile,
} from '@ddd-ts-kit/kernel';
import { defineContextModule } from '../src';
import { createTestApplication } from './support/on-container';

const PDF = Buffer.from('%PDF-1.7\n%%EOF\n');

class AttachDocument extends Command<StoredFile> {
  readonly document: FileUpload;

  constructor(file: Readable) {
    super();

    this.document = new FileUpload(
      { fileName: 'referral.pdf', mediaType: 'application/pdf', stream: file },
      'documents',
    );
  }
}

class AttachDocumentHandler {
  async execute(command: AttachDocument): Promise<StoredFile> {
    return command.document.file;
  }
}

describe('a command that carries a file, through the command bus of the application', () => {
  it('is staged by the file keys and the staging the modules bind, before the unit of work opens', async () => {
    const storage = new InMemoryFileStorage();

    const documents = defineContextModule({
      name: 'documents',
      register(builder) {
        builder.bind(FileKeys).toFactory((resolve) => new TenantFileKeys(resolve(IdGenerator), resolve(Clock)));

        builder
          .bind(FileStaging)
          .toFactory((resolve) => new FileStaging(storage, new AcceptEveryFileScanner(), resolve(ErrorReporter)));

        builder.command(AttachDocument).handledBy(AttachDocumentHandler, []);
      },
    });

    const app = createTestApplication({ modules: [documents] });

    const file = await app.commandBus.execute(new AttachDocument(Readable.from([PDF])));

    expect(file).toMatchObject({ key: 'documents/2026/01/id-1', size: PDF.length, mediaType: 'application/pdf' });
    expect(storage.keys()).toEqual(['staging/documents/2026/01/id-1']);
  });
});
