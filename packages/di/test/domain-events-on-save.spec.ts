import { beforeEach, describe, expect, it } from 'vitest';
import { CommandBus, InMemoryEventBus } from '@ddd-ts-kit/kernel';
import { contextModule, defineContextModule, fake, kernelModule, type Application, type BindingAspect } from '../src';
import { createApplication, createTestApplication } from './support/on-container';
import { TransactionalJournal } from './support/fakes/transactional-journal';
import { TransactionalUnitOfWork } from './support/fakes/transactional-unit-of-work';
import {
  JournalLoanRepository,
  Loan,
  LoanOpenedPublisher,
  LoanRepository,
  OpenLoan,
  OpenLoanHandler,
} from './fixtures/contexts/lending/lending';

const lending = [OpenLoanHandler, LoanOpenedPublisher, JournalLoanRepository];

interface Bench {
  readonly app: Application;
  readonly loans: TransactionalJournal;
  readonly outbox: TransactionalJournal;
  readonly unitOfWork: TransactionalUnitOfWork;
}

/** An application whose repository and outbox write in the transaction of a database-like unit of work. */
function aBench(aspects: readonly BindingAspect[] = []): Bench {
  const loans = new TransactionalJournal('loans');
  const outbox = new TransactionalJournal('outbox');
  const unitOfWork = new TransactionalUnitOfWork([loans, outbox]);

  const eventPublisher = {
    publish: async (events: readonly { id: string }[]) => events.forEach(({ id }) => outbox.write(id)),
  };

  const decorated = defineContextModule({
    name: 'policies',
    register: (builder) =>
      void builder
        .rebind(LoanRepository)
        .toClass(JournalLoanRepository)
        .as('repository')
        .with(...aspects),
  });

  JournalLoanRepository.journal = loans;

  const modules = [kernelModule({ unitOfWork, eventPublisher }), contextModule('lending', lending), decorated];

  return { app: createApplication({ modules }), loans, outbox, unitOfWork };
}

/** A retry written as a binding aspect: the method again, once, after a failure. */
const retryingOnce: BindingAspect = (instance) => {
  const save: unknown = Reflect.get(instance, 'save');

  if (typeof save !== 'function') {
    return instance;
  }

  Reflect.set(instance, 'save', async (...args: unknown[]): Promise<unknown> => {
    try {
      return await Reflect.apply(save, instance, args);
    } catch {
      return Reflect.apply(save, instance, args);
    }
  });

  return instance;
};

beforeEach(() => {
  JournalLoanRepository.failures = 0;
  JournalLoanRepository.saves = 0;
  LoanOpenedPublisher.failure = undefined;
});

describe('a handler that only saves', () => {
  it('has its domain events handled, and the outbox written, in the unit of work of the command', async () => {
    const { app, loans, outbox, unitOfWork } = aBench();

    await expect(app.resolve(CommandBus).execute(new OpenLoan('l1'))).resolves.toBe('l1');

    expect(loans.lines()).toEqual(['loan l1']);
    expect(outbox.lines()).toEqual(['evt-l1']);
    expect(unitOfWork.outcomes).toEqual(['committed']);
  });

  it('fails with the domain event handler that failed: neither the state nor the outbox is committed', async () => {
    const { app, loans, outbox, unitOfWork } = aBench();

    LoanOpenedPublisher.failure = new Error('broker schema refused');

    await expect(app.resolve(CommandBus).execute(new OpenLoan('l1'))).rejects.toThrow('broker schema refused');
    expect(loans.lines()).toEqual([]);
    expect(outbox.lines()).toEqual([]);
    expect(unitOfWork.outcomes).toEqual(['rolled back']);
  });

  it('dispatches nothing when the save fails', async () => {
    const { app, outbox } = aBench();

    JournalLoanRepository.failures = 1;

    await expect(app.resolve(CommandBus).execute(new OpenLoan('l1'))).rejects.toThrow('deadlock detected');
    expect(outbox.lines()).toEqual([]);
  });
});

describe('the dispatch among the wrappers of a repository', () => {
  it('is outside the aspects of the binding: a retried save dispatches once', async () => {
    const { app, loans, outbox } = aBench([retryingOnce]);

    JournalLoanRepository.failures = 1;
    await app.resolve(CommandBus).execute(new OpenLoan('l1'));

    expect(JournalLoanRepository.saves).toBe(2);
    expect(loans.lines()).toEqual(['loan l1']);
    expect(outbox.lines()).toEqual(['evt-l1']);
  });

  it('is not retried itself: a handler that fails does not make the save run again', async () => {
    const { app } = aBench([retryingOnce]);

    LoanOpenedPublisher.failure = new Error('handler failed');

    await expect(app.resolve(CommandBus).execute(new OpenLoan('l1'))).rejects.toThrow('handler failed');
    expect(JournalLoanRepository.saves).toBe(1);
  });

  it('is inside the decorate hook, which sees the save end before anything is announced: the events wait for the end of the unit of work', async () => {
    const calls: string[] = [];
    const loans = new TransactionalJournal('loans');
    const eventBus = new InMemoryEventBus();

    JournalLoanRepository.journal = loans;

    const app = createApplication({
      modules: [
        kernelModule({ unitOfWork: new TransactionalUnitOfWork([loans]), eventBus }),
        contextModule('lending', lending),
      ],
      decorate: (instance, { kind }) => {
        if (kind !== 'repository' || typeof instance !== 'object' || instance === null) {
          return instance;
        }

        const save: unknown = Reflect.get(instance, 'save');

        if (typeof save !== 'function') {
          return instance;
        }

        Reflect.set(instance, 'save', async (...args: unknown[]): Promise<void> => {
          calls.push('save starts');
          await Reflect.apply(save, instance, args);
          calls.push(`save ends, ${eventBus.published.length} event(s) published`);
        });

        return instance;
      },
    });

    await app.resolve(CommandBus).execute(new OpenLoan('l1'));

    expect(calls).toEqual(['save starts', 'save ends, 0 event(s) published']);
    expect(eventBus.published).toHaveLength(1);
  });
});

describe('which bindings dispatch', () => {
  it('a port extending the kernel Repository does without being told its kind, a port without kind does not', () => {
    abstract class Ledger {
      abstract save(loan: Loan): Promise<void>;
    }

    const module = defineContextModule({
      name: 'lending',
      register(builder) {
        builder.bind(LoanRepository).toClass(JournalLoanRepository);
        builder.bind(Ledger).toValue({ save: async () => undefined });
      },
    });

    const { bindings } = createApplication({ modules: [kernelModule(), module] }).describe();

    expect(bindings.find(({ token }) => token === 'LoanRepository')?.kind).toBe('repository');
    expect(bindings.find(({ token }) => token === 'Ledger')?.kind).toBeUndefined();
  });
});

describe('a test application', () => {
  it('dispatches with the save of the fake given for a repository port', async () => {
    const saved: string[] = [];

    const fakeLoans: LoanRepository = {
      findById: async () => undefined,
      save: async (loan) => void saved.push(loan.id),
    };

    const app = createTestApplication({
      modules: [contextModule('lending', lending)],
      fakes: [fake(LoanRepository, fakeLoans)],
    });

    await app.commandBus.execute(new OpenLoan('l1'));

    expect(saved).toEqual(['l1']);
    expect(app.eventBus.published.map(({ id }) => id)).toEqual(['evt-l1']);
  });

  it('dispatches with the save of the adapter of the module, whether the kernel module is listed or not', async () => {
    for (const modules of [[contextModule('lending', lending)], [kernelModule(), contextModule('lending', lending)]]) {
      const journal = new TransactionalJournal('loans');
      const app = createTestApplication({ modules });

      JournalLoanRepository.journal = journal;
      journal.begin();
      await app.commandBus.execute(new OpenLoan('l1'));

      expect(app.eventBus.published.map(({ id }) => id)).toEqual(['evt-l1']);
      expect(journal.has('loan l1')).toBe(true);
    }
  });
});
