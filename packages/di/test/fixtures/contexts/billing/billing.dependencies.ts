import { Clock, CommandBus, IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { injected } from '@ddd-ts-kit/kernel/declarations';
import { IssueInvoiceHandler } from './application/commands/issue-invoice/issue-invoice.handler';
import { InvoiceIssuedPublisher } from './application/integration/publishers/invoice-issued.publisher';
import { CustomerDirectory } from './application/ports/customer-directory.port';
import { IssueMonthlyInvoicesJob } from './application/scheduling/issue-monthly-invoices.job';
import { InvoiceRepository } from './domain/repositories/invoice.repository';
import { OutboxMailer } from './infrastructure/external/outbox-mailer.adapter';

injected(IssueInvoiceHandler, [InvoiceRepository, CustomerDirectory, IdGenerator, Clock]);
injected(InvoiceIssuedPublisher, [IntegrationEventPublisher, IdGenerator]);
injected(IssueMonthlyInvoicesJob, [CommandBus]);
injected(OutboxMailer, [Clock]);
