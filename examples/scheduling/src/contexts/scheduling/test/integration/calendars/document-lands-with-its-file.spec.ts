import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AcceptEveryFileScanner,
  FileStaging,
  FixedClock,
  FixedExecutionScope,
  InMemoryCommandBus,
  InMemoryErrorReporter,
  LocalFileStorage,
  SequentialIdGenerator,
  TenantFileKeys,
  atCommit,
  executionContext,
  fileUploadsMiddleware,
  stagedKeyOf,
  unitOfWorkMiddleware,
  type BusMiddleware,
} from '@ddd-ts-kit/kernel';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { AttachAppointmentDocumentCommand } from '@/contexts/scheduling/calendars/application/commands/attach-appointment-document/attach-appointment-document.command';
import { AttachAppointmentDocumentHandler } from '@/contexts/scheduling/calendars/application/commands/attach-appointment-document/attach-appointment-document.handler';
import { KnexAppointmentRepository } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-appointment.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const PDF = '%PDF-1.7\n%%EOF\n';
const holder = anActor().withRole('holder').ofTenant('north').build();
const clock = new FixedClock(new Date('2026-03-02T09:10:00.000Z'));

const scope = new FixedExecutionScope(
  executionContext({ correlationId: 'documents-spec', actor: holder, origin: 'test', tenantId: 'north' }),
);

let database: TestDatabase;
let directory: string;

beforeAll(async () => {
  database = await openTestDatabase();
});

beforeEach(async () => {
  await database.reset();
  directory = mkdtempSync(path.join(tmpdir(), 'scheduling-documents-'));

  return () => rmSync(directory, { recursive: true, force: true });
});

afterAll(async () => {
  await database.close();
});

describe('The document of an appointment and its file, on the database and the local storage of development', () => {
  it('land together: the row records the key, and the file is under that key once committed', async () => {
    const { bus, appointments, storage } = await arrange();

    const key = await bus.execute(new AttachAppointmentDocumentCommand(holder, 'appointment-1', aScan()));

    expect((await appointments.findById('appointment-1'))?.document?.file.key).toBe(key);
    expect(await storage.stat(key)).toMatchObject({ size: PDF.length, mediaType: 'application/pdf' });
    expect(await storage.stat(stagedKeyOf(key))).toBeUndefined();
  });

  it('roll back together: once the file was moved, a refused commit returns it to staging/ and the row keeps no document', async () => {
    const { bus, appointments, storage } = await arrange(refusedAtCommit());
    const command = new AttachAppointmentDocumentCommand(holder, 'appointment-1', aScan());

    await expect(bus.execute(command)).rejects.toThrow('commit refused');

    const { key } = command.document.file;

    expect((await appointments.findById('appointment-1'))?.document).toBeUndefined();
    expect(await storage.stat(key)).toBeUndefined();
    expect(await storage.stat(stagedKeyOf(key))).toMatchObject({ size: PDF.length });
  });
});

function aScan() {
  return { fileName: 'referral.pdf', mediaType: 'application/pdf', stream: Readable.from([Buffer.from(PDF)]) };
}

/** The handler of the application behind the bus middlewares that stage the file and open the transaction. */
async function arrange(...inside: readonly BusMiddleware[]) {
  const { unitOfWork, database: context } = database.persistence;
  const appointments = new KnexAppointmentRepository(context, scope, clock);
  const storage = new LocalFileStorage({ directory });
  const staging = new FileStaging(storage, new AcceptEveryFileScanner(), new InMemoryErrorReporter());
  const keys = new TenantFileKeys(new SequentialIdGenerator('file'), clock, scope);

  await unitOfWork.run(() => appointments.save(anAppointment().identifiedBy('appointment-1').build()));

  const bus = new InMemoryCommandBus()
    .use(fileUploadsMiddleware(() => ({ keys, staging })))
    .use(unitOfWorkMiddleware(unitOfWork));

  for (const middleware of inside) {
    bus.use(middleware);
  }

  bus.register(AttachAppointmentDocumentCommand, new AttachAppointmentDocumentHandler(appointments, staging, clock));

  return { bus, appointments, storage };
}

/** Refuses the commit once the handler has saved, inside the transaction: what a conflict detected at the commit does. */
function refusedAtCommit(): BusMiddleware {
  return async (_message, next) => {
    const result = await next();

    await atCommit({ apply: () => Promise.reject(new Error('commit refused')), undo: async () => undefined });

    return result;
  };
}
