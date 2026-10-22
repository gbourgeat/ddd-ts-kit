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
  atCommit,
  stagedKeyOf,
  type FileScanner,
  type FileStorage,
  type ScanVerdict,
} from '../src';
import { FailingFileStorage } from './support/failing-file-storage';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const PDF = new Uint8Array(Buffer.from('%PDF-1.7\n%%EOF\n'));
const KEY = 'appointment-documents/2026/03/doc-1';
const A_DAY_MS = 86_400_000;

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

function onFailing(storage: FileStorage) {
  const reporter = new InMemoryErrorReporter();

  return { reporter, staging: new FileStaging(storage, { scan: async () => ({ accepted: true }) }, reporter) };
}

const codeOf = (work: Promise<unknown>) =>
  work.then(
    () => 'resolved',
    (error: unknown) => (FileError.is(error) ? error.code : String(error)),
  );

const aPdf = () => Readable.from([PDF]);

describe('FileStaging', () => {
  it('stages a file under staging/, invisible under its key, and answers the reference with the final key', async () => {
    const { staging, storage } = aDesk();

    const file = await staging.stage(KEY, aPdf(), { mediaType: 'application/pdf' });

    expect(file).toMatchObject({ key: KEY, size: PDF.length, mediaType: 'application/pdf' });
    expect(storage.keys()).toEqual([stagedKeyOf(KEY)]);
  });

  it('refuses a final key under staging/, which the purge would remove', async () => {
    const { staging } = aDesk();

    expect(await codeOf(staging.stage('staging/doc-1', aPdf(), { mediaType: 'application/pdf' }))).toBe(
      'INVALID_FILE_KEY',
    );

    expect(await codeOf(staging.promote('staging/doc-1'))).toBe('INVALID_FILE_KEY');
  });

  it('promotes the file as the last step of the unit of work, after its work, so that both land together', async () => {
    const { staging, storage, unitOfWork } = aDesk();
    const seenInside: string[][] = [];

    await staging.stage(KEY, aPdf(), { mediaType: 'application/pdf' });

    await unitOfWork.run(async () => {
      await staging.promoteOnCommit(KEY);
      seenInside.push([...storage.keys()]);
    });

    expect(seenInside).toEqual([[stagedKeyOf(KEY)]]);
    expect(storage.keys()).toEqual([KEY]);
  });

  it('leaves the file staged when the command rolls back, and the purge removes it a day later', async () => {
    const { staging, storage, unitOfWork, clock } = aDesk();

    await staging.stage(KEY, aPdf(), { mediaType: 'application/pdf' });

    const failure = unitOfWork.run(async () => {
      await staging.promoteOnCommit(KEY);
      throw new Error('the appointment was cancelled meanwhile');
    });

    await expect(failure).rejects.toThrow('cancelled meanwhile');
    expect(storage.keys()).toEqual([stagedKeyOf(KEY)]);

    expect(await staging.purge(new Date(clock.now().getTime() - A_DAY_MS))).toBe(0);
    clock.advance(A_DAY_MS + 1);
    expect(await staging.purge(new Date(clock.now().getTime() - A_DAY_MS))).toBe(1);
    expect(storage.keys()).toEqual([]);
  });

  it('returns a promoted file to staging/ when the transaction rolls back after the promotion', async () => {
    const { staging, storage, unitOfWork } = aDesk();

    await staging.stage(KEY, aPdf(), { mediaType: 'application/pdf' });

    const failure = unitOfWork.run(async () => {
      await staging.promoteOnCommit(KEY);
      await atCommit({ apply: () => Promise.reject(new Error('commit refused')), undo: async () => undefined });
    });

    await expect(failure).rejects.toThrow('commit refused');
    expect(storage.keys()).toEqual([stagedKeyOf(KEY)]);
  });

  it('fails the command when the promotion fails: no row commits that points to a missing file', async () => {
    const { staging, unitOfWork } = aDesk();

    expect(await codeOf(unitOfWork.run(() => staging.promoteOnCommit(KEY)))).toBe('FILE_NOT_FOUND');
  });

  it('keeps a committed file out of the purge, however long after', async () => {
    const { staging, storage, unitOfWork, clock } = aDesk();

    await staging.stage(KEY, aPdf(), { mediaType: 'application/pdf' });
    await unitOfWork.run(() => staging.promoteOnCommit(KEY));
    clock.advance(30 * A_DAY_MS);

    await new PurgeStagedFiles(staging, clock).run();
    expect(storage.keys()).toEqual([KEY]);
  });

  it('promotes at once outside of a unit of work, and promoting twice is not an error', async () => {
    const { staging, storage } = aDesk();

    await staging.stage(KEY, aPdf(), { mediaType: 'application/pdf' });
    await staging.promoteOnCommit(KEY);
    await staging.promote(KEY);

    expect(storage.keys()).toEqual([KEY]);
    expect(await codeOf(staging.promote('appointment-documents/never'))).toBe('FILE_NOT_FOUND');
  });

  it('reports a promoted file it could not return to staging/', async () => {
    const { staging, reporter } = onFailing(new FailingFileStorage({ movesInto: 'staging/' }));

    await staging.stage(KEY, aPdf(), { mediaType: 'application/pdf' });

    await new InMemoryUnitOfWork()
      .run(async () => {
        await staging.promoteOnCommit(KEY);
        await atCommit({ apply: () => Promise.reject(new Error('commit refused')), undo: async () => undefined });
      })
      .catch(() => undefined);

    expect(reporter.reports.map(({ report }) => report.operation)).toEqual(['return file to staging']);
  });

  it('removes a file its scanner refuses, after letting it read the content', async () => {
    const scanner = new RefusingScanner();
    const { staging, storage } = aDesk(scanner);

    expect(await codeOf(staging.stage(KEY, aPdf(), { mediaType: 'application/pdf' }))).toBe('FILE_REJECTED');
    expect(scanner.read).toEqual([PDF.length]);
    expect(storage.keys()).toEqual([]);
  });
});

describe('FileStaging, after the commit', () => {
  it('is purged every hour by the job of the platform, of what was staged a day ago or more', async () => {
    const { staging, storage, clock } = aDesk();
    const job = new PurgeStagedFiles(staging, clock);

    await staging.stage(KEY, aPdf(), { mediaType: 'application/pdf' });
    await job.run();
    expect(storage.keys()).toEqual([stagedKeyOf(KEY)]);

    clock.advance(A_DAY_MS + 1);
    await job.run();
    expect(storage.keys()).toEqual([]);
  });

  it('deletes a file the aggregate no longer references once the command has committed, never on a rollback', async () => {
    const { staging, storage, unitOfWork } = aDesk();

    await storage.put(KEY, aPdf(), { mediaType: 'application/pdf' });

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
    const { staging, reporter } = onFailing(new FailingFileStorage({ deletes: true }));

    await new InMemoryUnitOfWork().run(() => staging.deleteAfterCommit(KEY));

    expect(reporter.reports.map(({ report }) => report.operation)).toEqual(['delete stored file']);
  });
});
