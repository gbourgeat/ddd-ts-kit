import { describe, expect, it } from 'vitest';
import { lines, projectWith, reported } from './rules-support.js';

const BILLING = 'src/contexts/billing';
const MODULE = `${BILLING}/billing.module.ts`;
const PORT = `${BILLING}/domain/repositories/invoice.repository.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const JOB = `${BILLING}/application/scheduling/send-reminders.job.ts`;
const DI = "import { defineModule } from '@ddd-ts-kit/di';";
const DECLARATIONS = "'@ddd-ts-kit/kernel/declarations'";

describe('binding calls', () => {
  const resolving = lines("export const root = path.resolve('data');", "export const ready = Promise.resolve('ready');", "export const clock = app.resolve('kernel.Clock');");

  it('are read only in a file that imports the container package', () => {
    const without = projectWith({ 'src/platform/paths.ts': resolving });
    const withContainer = projectWith({ 'src/platform/paths.ts': `${DI}\n${resolving}` });

    expect(reported(without, 'ports/no-token-constant')).toEqual([]);
    expect(reported(withContainer, 'ports/no-token-constant')).toEqual([{ file: 'src/platform/paths.ts', line: 4, message: 'resolve(...) is given a string as its token.' }]);
  });

  it('report a symbol where it is declared, a string and a symbol written in place where they are given', () => {
    const module = lines(DI, "const gateway = Symbol('gateway');", 'builder.bind(gateway).toValue(stripe);', "builder.rebind(Symbol.for('clock')).toValue(clock);", "test.override('billing.currency', 'EUR');");
    const root = projectWith({ [MODULE]: module });

    expect(reported(root, 'ports/no-token-constant').map(({ line, message }) => `${line}: ${message}`)).toEqual([
      '2: gateway is a symbol declared as an injection token and given to bind(...).',
      '4: rebind(...) is given a symbol as its token.',
      '5: override(...) is given a string as its token.',
    ]);
  });
});

describe('ports/implements-never-extends', () => {
  const module = lines(DI, "import { InvoiceRepository } from './domain/repositories/invoice.repository.js';", "import { KnexInvoiceRepository } from './infrastructure/persistence/knex-invoice.repository.js';", 'builder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, []);');
  const adapter = (heritage: string): string => lines("import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';", `export class KnexInvoiceRepository ${heritage} {}`);

  it('reads the bound class in its own file, in check and in check-file alike', () => {
    const root = projectWith({ [MODULE]: module, [ADAPTER]: adapter('') });

    expect(reported(root, 'ports/implements-never-extends')).toEqual([{ file: MODULE, line: 4, message: 'KnexInvoiceRepository is bound to InvoiceRepository without implementing it.' }]);
    expect(reported(root, 'ports/implements-never-extends', MODULE).map(({ line }) => line)).toEqual([4]);
    expect(reported(projectWith({ [MODULE]: module, [ADAPTER]: adapter('implements InvoiceRepository') }), 'ports/implements-never-extends')).toEqual([]);
  });

  it('says nothing of a class it cannot read, and of a class bound to itself', () => {
    const packaged = lines(DI, "import { StripeGateway } from 'stripe-gateway';", 'builder.bind(PaymentGateway).toClass(StripeGateway, []);', 'builder.bind(Numbering).toClass(Numbering, []);');

    expect(reported(projectWith({ [MODULE]: packaged }), 'ports/implements-never-extends')).toEqual([]);
  });

  it('reports an adapter that extends its port once, on the class', () => {
    const declared = lines(`import { Repository } from ${DECLARATIONS};`, "import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';", '', '@Repository(InvoiceRepository, [])', 'export class KnexInvoiceRepository extends InvoiceRepository {}');
    const root = projectWith({ [PORT]: 'export abstract class InvoiceRepository {}\n', [ADAPTER]: declared });

    expect(reported(root, 'ports/implements-never-extends')).toEqual([{ file: ADAPTER, line: 5, message: 'KnexInvoiceRepository extends its port InvoiceRepository: an adapter implements its port, it never extends it.' }]);
  });
});

describe('dependency lists', () => {
  const handler = (imports: string, list: string): string => lines(`import { CommandHandler } from ${DECLARATIONS};`, imports, '', `@CommandHandler(IssueInvoiceCommand, ${list})`, 'export class IssueInvoiceHandler {}');

  it('name ports imported as values, whatever the form of the type import', () => {
    const whole = projectWith({ [HANDLER]: handler("import type { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';", '[InvoiceRepository]') });
    const inline = projectWith({ [HANDLER]: handler("import { type Clock, IdGenerator } from '@ddd-ts-kit/kernel';", '[\n  IdGenerator,\n  Clock,\n]') });

    expect(reported(whole, 'ports/value-import').map(({ line }) => line)).toEqual([4]);
    expect(reported(inline, 'ports/value-import')).toEqual([{ file: HANDLER, line: 6, message: 'Clock is imported as a type and named in the dependency list of @CommandHandler: at run time the token would be undefined.' }]);
  });

  it('are read on a decorator, on toClass and on handledBy, and only there', () => {
    const module = lines(DI, 'const LIMITS = [MAX_LINES, MIN_LINES];', 'builder.bind(Mailer).toClass(SmtpMailer, [SMTP_SETTINGS]);', 'builder.command(IssueInvoiceCommand).public().handledBy(IssueInvoiceHandler, [CLOCK]);');
    const root = projectWith({ [MODULE]: module, [HANDLER]: handler('', '[ID_GENERATOR]') });

    expect(reported(root, 'ports/no-token-constant').map(({ file, line, message }) => `${file === MODULE ? 'module' : 'handler'}:${line} ${message.split(':')[0]}`)).toEqual([
      'handler:4 The dependency list of @CommandHandler names the constant ID_GENERATOR',
      'module:3 The dependency list of toClass names the constant SMTP_SETTINGS',
      'module:4 The dependency list of handledBy names the constant CLOCK',
    ]);
  });
});

describe('scheduling', () => {
  const job = (name: string, className: string): string =>
    lines(`import { Scheduled } from ${DECLARATIONS};`, '', `@Scheduled('${name}', { every: '15m' }, [CommandBus])`, `export class ${className} implements ScheduledJob {`, '  async run(): Promise<void> {', `    await this.commands.execute(new SendReminders(systemActor('${name}')));`, '  }', '}');

  it('holds the uniqueness of a job name in the full check, not in check-file', () => {
    const other = `${BILLING}/application/scheduling/send-reminders-again.job.ts`;
    const root = projectWith({ [JOB]: job('billing.send-reminders', 'SendRemindersJob'), [other]: job('billing.send-reminders', 'SendRemindersAgainJob') });

    expect(reported(root, 'scheduling/job-name').map(({ message }) => message)).toEqual([expect.stringMatching(/^The job name "billing.send-reminders" is already used in .+\.job\.ts:3\.$/)]);
    expect(reported(root, 'scheduling/job-name', JOB)).toEqual([]);
    expect(reported(root, 'scheduling/job-name', other)).toEqual([]);
  });

  it('asks a module file for the context of the module, and any other place for a well-formed name', () => {
    const registering = (name: string): string => lines(DI, `builder.job('${name}', { every: '1h' }).handledBy(SendRemindersJob, [CommandBus]);`);
    const root = projectWith({ [MODULE]: registering('shipping.send-reminders'), 'src/platform/jobs.ts': registering('platform.purge-outbox'), 'src/platform/more-jobs.ts': registering('purge') });

    expect(reported(root, 'scheduling/job-name')).toEqual([
      { file: MODULE, line: 2, message: 'The job name "shipping.send-reminders" does not start with its context, "billing".' },
      { file: 'src/platform/more-jobs.ts', line: 2, message: 'The job name "purge" does not follow <context>.<job-name>.' },
    ]);
  });

  it('reports a class carrying @Scheduled outside a job file, in the style where nothing else does', () => {
    const misplaced = `${BILLING}/application/event-handlers/send-reminders.event-handler.ts`;
    const files = { [misplaced]: job('billing.send-reminders', 'SendRemindersJob') };

    expect(reported(projectWith(files), 'scheduling/job-triggers-use-case').map(({ file }) => file)).toEqual([misplaced]);
    expect(reported(projectWith(files, { stack: { style: 'declared' } }), 'scheduling/job-triggers-use-case')).toEqual([]);
    expect(reported(projectWith(files, { stack: { style: 'declared' } }), 'declarations/role-declared').map(({ file }) => file)).toEqual([misplaced]);
  });
});
