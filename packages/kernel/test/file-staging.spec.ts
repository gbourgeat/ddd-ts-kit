import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  FileError,
  FileStaging,
  FixedClock,
  InMemoryErrorReporter,
  InMemoryFileStorage,
  InMemoryUnitOfWork,
  PurgeStagedFiles,
  stagedKeyOf,
  type FileScanner,
  type ScanVerdict,
} from '../src/index.js';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const PDF = new Uint8Array(Buffer.from('%PDF-1.7\n%%EOF\n'));
const KEY = 'appointment-documents/2026/03/doc-1';
const PDF_ONLY = { mediaType: 'application/pdf', accepted: ['application/pdf'] };

class RefusingScanner implements FileScanner {
  readonly read: number[] = [];

  async scan(_file: unknown, open: () => Promise<Readable>): Promise<ScanVerdict> {
    let size = 0;

    for await (const chunk of await open()) {
      size += Buffer.byteLength(chunk instanceof Uint8Array ? chunk : String(chunk));
    }

    this.read.push(size);

    return { accepted: false, reason: 'INFECTED' };
  }
}

function aDesk(scanner: FileScanner = { scan: async () => ({ accepted: true }) }) {
  const clock = new FixedClock(NOW);
  const storage = new InMemoryFileStorage({ clock });
  const reporter = new InMemoryErrorReporter();

  return {
    clock,
    storage,
    reporter,
    staging: new FileStaging(storage, scanner, reporter),
    unitOfWork: new InMemoryUnitOfWork(),
  };
}

const codeOf = (work: Promise<unknown>) =>
  work.then(
    () => 'resolved',
    (error: unknown) => (FileError.is(error) ? error.code : String(error)),
  );

describe('FileStaging', () => {
  it('stages a file under staging/, invisible under its key, and answers the reference with the final key', async () => {
    const { staging, storage } = aDesk();

    const file = await staging.stage(KEY, Readable.from([PDF]), { mediaType: 'application/pdf' });

    expect(file).toMatchObject({ key: KEY, size: PDF.length, mediaType: 'application/pdf' });
    expect(storage.keys()).toEqual([stagedKeyOf(KEY)]);
  });

  it('promotes the file once the unit of work has committed, and not before', async () => {
    const { staging, storage, unitOfWork } = aDesk();
    const seenInside: string[][] = [];

    await unitOfWork.run(async () => {
      await staging.stage(KEY, Readable.from([PDF]), { mediaType: 'application/pdf' });
      await staging.promoteAfterCommit(KEY);
      seenInside.push([...storage.keys()]);
    });

    expect(seenInside).toEqual([[stagedKeyOf(KEY)]]);
    expect(storage.keys()).toEqual([KEY]);
  });

  it('leaves no visible file when the command rolls back, and the purge removes what it staged', async () => {
    const { staging, storage, unitOfWork, clock } = aDesk();

    const failure = unitOfWork.run(async () => {
      await staging.stage(KEY, Readable.from([PDF]), { mediaType: 'application/pdf' });
      await staging.promoteAfterCommit(KEY);
      throw new Error('the appointment was cancelled meanwhile');
    });

    await expect(failure).rejects.toThrow('cancelled meanwhile');
    expect(await storage.stat(KEY)).toBeUndefined();

    expect(await staging.purge(new Date(clock.now().getTime() - 60_000))).toBe(0);
    clock.advance(3_600_000);
    expect(await staging.purge(new Date(clock.now().getTime() - 60_000))).toBe(1);
    expect(storage.keys()).toEqual([]);
  });

  it('promotes at once outside of a unit of work, and promoting twice is not an error', async () => {
    const { staging, storage } = aDesk();

    await staging.stage(KEY, Readable.from([PDF]), { mediaType: 'application/pdf' });
    await staging.promoteAfterCommit(KEY);
    await staging.promote(KEY);

    expect(storage.keys()).toEqual([KEY]);
    expect(await codeOf(staging.promote('appointment-documents/never'))).toBe('FILE_NOT_FOUND');
  });

  it('reports a promotion that fails after the commit, and does not fail the command', async () => {
    const { staging, reporter, unitOfWork } = aDesk();

    await unitOfWork.run(() => staging.promoteAfterCommit(KEY));

    expect(reporter.reports.map(({ report }) => [report.operation, report.errorCode])).toEqual([
      ['promote staged file', 'FILE_NOT_FOUND'],
    ]);
  });

  it('removes a file its scanner refuses, after letting it read the content', async () => {
    const scanner = new RefusingScanner();
    const { staging, storage } = aDesk(scanner);

    expect(await codeOf(staging.stage(KEY, Readable.from([PDF]), { mediaType: 'application/pdf' }))).toBe(
      'FILE_REJECTED',
    );

    expect(scanner.read).toEqual([PDF.length]);
    expect(storage.keys()).toEqual([]);
  });
});

describe('FileStaging, for a file sent straight to the storage', () => {
  it('confirms a file uploaded through its link: measured, checked on its bytes, still staged', async () => {
    const { staging, storage } = aDesk();
    const upload = await staging.uploadUrl(KEY, { expiresInSeconds: 300, mediaType: 'application/pdf' });

    await storage.acceptSigned(
      new URL(upload.url).searchParams.get('token') ?? '',
      Readable.from([PDF]),
      'application/pdf',
    );

    const file = await staging.confirm(KEY, { ...PDF_ONLY, maxBytes: 1_000 });

    expect(file).toMatchObject({ key: KEY, size: PDF.length, mediaType: 'application/pdf' });
    expect(file.checksum).toMatch(/^sha256:/);
    expect(storage.keys()).toEqual([stagedKeyOf(KEY)]);
  });

  it('discards an uploaded file that is not what it declared, or larger than allowed, or missing', async () => {
    const { staging, storage } = aDesk();

    await storage.put(stagedKeyOf(KEY), Readable.from([Buffer.from('<html>')]), { mediaType: 'application/pdf' });
    expect(await codeOf(staging.confirm(KEY, PDF_ONLY))).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(storage.keys()).toEqual([]);

    await storage.put(stagedKeyOf(KEY), Readable.from([PDF]), { mediaType: 'application/pdf' });
    expect(await codeOf(staging.confirm(KEY, { ...PDF_ONLY, maxBytes: 4 }))).toBe('FILE_TOO_LARGE');
    expect(await codeOf(staging.confirm(KEY, PDF_ONLY))).toBe('FILE_NOT_FOUND');
  });
});

describe('FileStaging, after the commit', () => {
  it('is purged every hour by the job of the platform, of what was staged a day ago or more', async () => {
    const { staging, storage, clock } = aDesk();
    const job = new PurgeStagedFiles(staging, clock);

    await staging.stage(KEY, Readable.from([PDF]), { mediaType: 'application/pdf' });
    await job.run();
    clock.advance(86_400_001);
    await job.run();

    expect(storage.keys()).toEqual([]);
  });

  it('deletes a file the aggregate no longer references once the command has committed, never on a rollback', async () => {
    const { staging, storage, unitOfWork } = aDesk();

    await storage.put(KEY, Readable.from([PDF]), { mediaType: 'application/pdf' });

    await unitOfWork
      .run(async () => {
        await staging.deleteAfterCommit(KEY);
        throw new Error('the appointment changed meanwhile');
      })
      .catch(() => undefined);

    expect(storage.keys()).toEqual([KEY]);

    await unitOfWork.run(() => staging.deleteAfterCommit(KEY));

    expect(storage.keys()).toEqual([]);
  });

  it('reports a deletion that fails after the commit', async () => {
    const reporter = new InMemoryErrorReporter();
    const failing = new InMemoryFileStorage();
    const staging = new FileStaging(failing, { scan: async () => ({ accepted: true }) }, reporter);

    failing.delete = () => Promise.reject(new Error('storage away'));
    await new InMemoryUnitOfWork().run(() => staging.deleteAfterCommit(KEY));

    expect(reporter.reports.map(({ report }) => report.operation)).toEqual(['delete stored file']);
  });
});
