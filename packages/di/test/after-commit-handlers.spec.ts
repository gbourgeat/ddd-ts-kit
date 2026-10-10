import { beforeEach, describe, expect, it } from 'vitest';
import { CommandBus, InMemoryErrorReporter, InMemoryLogger } from '@ddd-ts-kit/kernel';
import { contextModule, createApplication, createTestApplication, fake, kernelModule } from '../src/index.js';
import { TransactionalJournal } from './support/fakes/transactional-journal.js';
import { TransactionalUnitOfWork } from './support/fakes/transactional-unit-of-work.js';
import {
  JournalLoanRepository,
  LoanOpenedNotice,
  LoanOpenedPublisher,
  LoanRepository,
  OpenLoan,
  OpenLoanHandler,
} from './fixtures/contexts/lending/lending.js';

const lending = [OpenLoanHandler, LoanOpenedPublisher, LoanOpenedNotice, JournalLoanRepository];

function aBench() {
  const loans = new TransactionalJournal('loans');
  const outbox = new TransactionalJournal('outbox');
  const errorReporter = new InMemoryErrorReporter();
  const logger = new InMemoryLogger();

  const eventPublisher = {
    publish: async (events: readonly { id: string }[]) => events.forEach(({ id }) => outbox.write(id)),
  };

  const kernel = kernelModule({
    unitOfWork: new TransactionalUnitOfWork([loans, outbox]),
    eventPublisher,
    errorReporter,
    logger,
  });

  JournalLoanRepository.journal = loans;
  LoanOpenedNotice.committed = () => [...loans.lines(), ...outbox.lines()];

  return {
    app: createApplication({ modules: [kernel, contextModule('lending', lending)] }),
    loans,
    errorReporter,
    logger,
  };
}

beforeEach(() => {
  JournalLoanRepository.failures = 0;
  LoanOpenedPublisher.failure = undefined;
  LoanOpenedNotice.failure = undefined;
  LoanOpenedNotice.sent = [];
});

describe('a domain event handler declared in the after-commit phase', () => {
  it('runs once the state and the outbox of the command are committed', async () => {
    const { app } = aBench();

    await app.resolve(CommandBus).execute(new OpenLoan('l1'));

    expect(LoanOpenedNotice.sent).toEqual(['l1 with loan l1,evt-l1 committed']);
  });

  it('never runs for a command that rolled back', async () => {
    const { app, loans } = aBench();

    LoanOpenedPublisher.failure = new Error('broker schema refused');

    await expect(app.resolve(CommandBus).execute(new OpenLoan('l1'))).rejects.toThrow('broker schema refused');
    expect(loans.lines()).toEqual([]);
    expect(LoanOpenedNotice.sent).toEqual([]);
  });

  it('cannot fail the command: its failure goes to the logger and the error reporter of the application', async () => {
    const { app, loans, errorReporter, logger } = aBench();
    const failure = new Error('mail server down');

    LoanOpenedNotice.failure = failure;

    await expect(app.resolve(CommandBus).execute(new OpenLoan('l1'))).resolves.toBe('l1');

    expect(loans.lines()).toEqual(['loan l1']);

    expect(errorReporter.reports.map(({ error, report }) => [error, report.operation])).toEqual([
      [failure, 'after-commit lending.loan.opened'],
    ]);

    expect(logger.entries.map(({ level, fields }) => [level, fields['domainEvent'], fields['errorType']])).toEqual([
      ['error', 'lending.loan.opened', 'Error'],
    ]);
  });

  it('is described with its phase', () => {
    const phases = aBench()
      .app.describe()
      .domainEventHandlers.map(({ handler, phase }) => [handler, phase]);

    expect(phases).toEqual([
      ['LoanOpenedPublisher', 'before-commit'],
      ['LoanOpenedNotice', 'after-commit'],
    ]);
  });
});

describe('the test application and the after-commit phase', () => {
  it('runs the handler after the command, and tells its failure in errors, logger and domainEvents', async () => {
    const saved: string[] = [];

    const repository = {
      findById: async () => undefined,
      save: async (loan: { id: string }) => void saved.push(`loan ${loan.id}`),
    };

    const application = createTestApplication({
      modules: [contextModule('lending', lending)],
      fakes: [fake(LoanRepository, repository)],
    });

    const failure = new Error('mail server down');

    LoanOpenedNotice.committed = () => [...saved, ...application.eventBus.published.map((event) => event.id)];
    await application.commandBus.execute(new OpenLoan('l1'));
    LoanOpenedNotice.failure = failure;
    await application.commandBus.execute(new OpenLoan('l2'));

    expect(LoanOpenedNotice.sent).toEqual(['l1 with loan l1,evt-l1 committed']);
    expect(application.domainEvents.afterCommitFailures.map(({ error }) => error)).toEqual([failure]);

    expect(application.errors.reports.map(({ report }) => report.operation)).toEqual([
      'after-commit lending.loan.opened',
    ]);
  });
});
