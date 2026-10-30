import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  Command,
  FileStaging,
  FileUpload,
  FixedClock,
  InMemoryCommandBus,
  InMemoryErrorReporter,
  InMemoryFileStorage,
  SequentialIdGenerator,
  TenantFileKeys,
  fileUploadsMiddleware,
  unitOfWorkMiddleware,
  withinUnitOfWork,
  type StoredFile,
} from '../src';

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

class Rename extends Command {}

function aBus() {
  const storage = new InMemoryFileStorage();

  const desk = {
    keys: new TenantFileKeys(new SequentialIdGenerator('file'), new FixedClock(new Date('2026-03-01T10:00:00.000Z'))),
    staging: new FileStaging(storage, { scan: async () => ({ accepted: true }) }, new InMemoryErrorReporter()),
  };

  const seenWhenTheTransactionBegan: string[][] = [];

  const unitOfWork = {
    run: <T>(work: () => Promise<T>) =>
      withinUnitOfWork(work, (scoped) => {
        seenWhenTheTransactionBegan.push([...storage.keys()]);

        return scoped();
      }),
  };

  const bus = new InMemoryCommandBus()
    .use(fileUploadsMiddleware(() => desk))
    .use(unitOfWorkMiddleware(unitOfWork))
    .register(AttachDocument, { execute: async (command) => command.document.file })
    .register(Rename, { execute: async () => undefined });

  return { bus, storage, seenWhenTheTransactionBegan };
}

describe('fileUploadsMiddleware', () => {
  it('stages the file of a command under a new key of its area, before the transaction begins', async () => {
    const { bus, storage, seenWhenTheTransactionBegan } = aBus();
    const command = new AttachDocument(Readable.from([PDF]));

    expect(command.document.fileName).toBe('referral.pdf');

    const file = await bus.execute(command);

    expect(file).toMatchObject({ key: 'documents/2026/03/file-1', size: PDF.length, mediaType: 'application/pdf' });
    expect(seenWhenTheTransactionBegan).toEqual([['staging/documents/2026/03/file-1']]);
    expect(storage.keys()).toEqual(['staging/documents/2026/03/file-1']);
  });

  it('resolves nothing for a command without a file', async () => {
    const bus = new InMemoryCommandBus()
      .use(
        fileUploadsMiddleware(() => {
          throw new Error('resolved for nothing');
        }),
      )
      .register(Rename, { execute: async () => undefined });

    await expect(bus.execute(new Rename())).resolves.toBeUndefined();
  });

  it('lets a handler know, as a defect of the wiring, that a file was never staged', () => {
    const command = new AttachDocument(Readable.from([PDF]));

    expect(() => command.document.file).toThrow('install fileUploadsMiddleware');
  });
});
