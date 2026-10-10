import {
  AggregateRoot,
  Command,
  IntegrationEventPublisher,
  Repository as RepositoryPort,
  type DomainEvent,
} from '@ddd-ts-kit/kernel';
import { CommandHandler, DomainEventHandler, Repository } from '@ddd-ts-kit/kernel/declarations';

export class LoanOpened implements DomainEvent {
  readonly name = 'lending.loan.opened';

  readonly occurredAt = new Date(0);

  constructor(readonly aggregateId: string) {}
}

export class Loan extends AggregateRoot {
  private constructor(id: string) {
    super(id);
  }

  static open(id: string): Loan {
    const loan = new Loan(id);

    loan.record(new LoanOpened(id));

    return loan;
  }
}

export abstract class LoanRepository extends RepositoryPort<Loan> {}

/** Writes in the journal of the transaction, and fails as many saves as it is told to. */
@Repository(LoanRepository)
export class JournalLoanRepository implements LoanRepository {
  static journal: { write(line: string): void };

  static failures = 0;

  static saves = 0;

  async findById(): Promise<Loan | undefined> {
    return undefined;
  }

  async save(loan: Loan): Promise<void> {
    JournalLoanRepository.saves += 1;

    if (JournalLoanRepository.failures > 0) {
      JournalLoanRepository.failures -= 1;

      throw Object.assign(new Error('deadlock detected'), { code: 'ETIMEDOUT' });
    }

    JournalLoanRepository.journal.write(`loan ${loan.id}`);
  }
}

export class OpenLoan extends Command<string> {
  constructor(readonly id: string) {
    super();
  }
}

/** The whole use case: build, save, answer. */
@CommandHandler(OpenLoan, [LoanRepository])
export class OpenLoanHandler implements CommandHandler<OpenLoan> {
  constructor(private readonly loans: LoanRepository) {}

  async execute(command: OpenLoan): Promise<string> {
    const loan = Loan.open(command.id);

    await this.loans.save(loan);

    return loan.id;
  }
}

@DomainEventHandler(LoanOpened, { name: 'lending.loan.opened' }, [IntegrationEventPublisher])
export class LoanOpenedPublisher implements DomainEventHandler<LoanOpened> {
  static failure: Error | undefined;

  constructor(private readonly publisher: IntegrationEventPublisher) {}

  async handle(event: LoanOpened): Promise<void> {
    if (LoanOpenedPublisher.failure !== undefined) throw LoanOpenedPublisher.failure;

    await this.publisher.publish([
      { id: `evt-${event.aggregateId}`, type: event.name, version: 1, occurredAt: event.occurredAt.toISOString(), payload: {} },
    ]);
  }
}
