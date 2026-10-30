import { describe, expect, it } from 'vitest';
import { runCheck } from '../src/check/engine/run-check';
import { loadProject } from '../src/check/project/load-project';
import { lines, projectWith, reported } from './rules-support';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';
const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const COMMAND = `${BILLING}/application/commands/send-reminder/send-reminder.command.ts`;
const CONTEXT_DOC = `${BILLING}/CONTEXT.md`;

const messages = (root: string, rule: string): string[] => reported(root, rule).map(({ message }) => message);

describe('the rules of the checker, on code written otherwise than the generator writes it', () => {
  it('authz/in-application reports the auth package imported by the domain', () => {
    const root = projectWith({
      [AGGREGATE]: lines("import { Access } from '@ddd-ts-kit/auth';", 'export class Invoice {}'),
    });

    expect(messages(root, 'authz/in-application')).toEqual([
      '"@ddd-ts-kit/auth" is imported in domain/: rights are decided in the application layer.',
    ]);
  });

  it('authz/system-actor-granted judges a system actor by its name, and cannot judge one given none', () => {
    const job = (actor: string): string =>
      lines(
        "import { systemActor } from '@ddd-ts-kit/auth';",
        "import { SendReminderCommand } from '@/contexts/billing/application/commands/send-reminder/send-reminder.command';",
        'export class SendReminders {',
        '  run() {',
        `    return new SendReminderCommand(systemActor(${actor}));`,
        '  }',
        '}',
      );

    const root = projectWith(
      {
        'src/platform/auth/relationships/relate-system-actors.ts': 'export const systemRelationships = [];\n',
        [COMMAND]: lines(
          "import { AuthorizedCommand } from '@ddd-ts-kit/kernel';",
          'export class SendReminderCommand extends AuthorizedCommand {}',
        ),
        [`${BILLING}/application/jobs/send-reminders.job.ts`]: job("'reminders'"),
        [`${BILLING}/application/jobs/send-digests.job.ts`]: job(''),
      },
      { stack: { authz: 'rebac' } },
    );

    expect(reported(root, 'authz/system-actor-granted').map(({ file }) => file)).toEqual([
      `${BILLING}/application/jobs/send-reminders.job.ts`,
    ]);
  });

  it('clean/blank-lines asks nothing of a return that only a comment precedes', () => {
    const root = projectWith({ [`${BILLING}/domain/services/pricing.ts`]: '// note\nreturn 1;\n' });

    expect(messages(root, 'clean/blank-lines')).toEqual([]);
  });

  it('clean/no-flag-argument exempts a message, which carries data, and judges the domain', () => {
    const root = projectWith({
      [COMMAND]: lines('export class SendReminderCommand {', '  execute(force: boolean): void {}', '}'),
      [AGGREGATE]: lines('export class Invoice {', '  issue(force: boolean): void {}', '}'),
    });

    expect(messages(root, 'clean/no-flag-argument')).toEqual(['Invoice.issue takes the flag "force".']);
  });
});

describe('the event and language rules of the checker, on code written otherwise than the generator writes it', () => {
  it('event-sourcing/upcaster-required asks no upcaster of a stored event without a version', () => {
    const root = projectWith({
      [`${BILLING}/infrastructure/persistence/invoice-events.mapper.ts`]: lines(
        "import { defineStoredEvent } from '@ddd-ts-kit/event-sourcing';",
        'interface InvoicePaidData { readonly cents: number }',
        'export const invoiceEvents = {',
        "  'billing.invoice.paid': defineStoredEvent(InvoicePaid, {",
        '    encode(event: InvoicePaid): InvoicePaidData {',
        '      return { cents: event.cents };',
        '    },',
        '  }),',
        '};',
      ),
    });

    expect(messages(root, 'event-sourcing/upcaster-required')).toEqual([]);
  });

  it('events/defined-in-published-language counts no declaration without a type as declared twice', () => {
    const declaration = lines(
      "import { defineIntegrationEvent } from '@ddd-ts-kit/events';",
      'export const event = defineIntegrationEvent({ version: 1, payload: schema });',
    );

    const root = projectWith({
      [`${BILLING}/published-language/invoice-issued.integration-event.ts`]: declaration,
      [`${BILLING}/published-language/invoice-paid.integration-event.ts`]: declaration,
    });

    expect(messages(root, 'events/defined-in-published-language')).toEqual([]);
  });

  it('governance/recorded-deviation reports a deviation that says neither what it relaxes nor its record', () => {
    const root = projectWith({}, { deviations: [{ what: '', adr: 'none', reason: 'because' }] });

    expect(messages(root, 'governance/recorded-deviation')).toEqual(
      expect.arrayContaining(['A deviation does not say what it relaxes.', 'A deviation names no decision record.']),
    );
  });

  it('language/glossary-term reports an empty glossary once, whatever the number of domain classes', () => {
    const root = projectWith({
      [CONTEXT_DOC]: lines('# Billing', '', '## Ubiquitous language', '', '| Term | Meaning |', '|---|---|'),
      [AGGREGATE]: 'export class Invoice {}\n',
      [`${BILLING}/domain/entities/line.entity.ts`]: 'export class Line {}\n',
    });

    expect(reported(root, 'language/glossary-term')).toEqual([
      { file: CONTEXT_DOC, line: 3, message: 'The context "billing" has domain classes but its glossary is empty.' },
    ]);
  });
});

describe('the layer and naming rules of the checker, on code written otherwise than the generator writes it', () => {
  it('layer/application-inward reports a Node built-in imported by the application layer', () => {
    const root = projectWith({
      [`${BILLING}/application/commands/send-reminder/send-reminder.handler.ts`]: lines(
        "import fs from 'node:fs';",
        'export class SendReminderHandler {}',
      ),
    });

    expect(messages(root, 'layer/application-inward')).toEqual([
      'The application layer imports the Node built-in "node:fs".',
    ]);
  });

  it('layer/domain-purity leaves the internals of another context to context/published-language-only, and reports its published language', () => {
    const root = projectWith({
      [AGGREGATE]: lines(
        "import { Parcel } from '@/contexts/shipping/domain/aggregates/parcel.aggregate';",
        "import { ParcelShipped } from '@/contexts/shipping/published-language/parcel-shipped.integration-event';",
        'export class Invoice {}',
      ),
      [`${SHIPPING}/domain/aggregates/parcel.aggregate.ts`]: 'export class Parcel {}\n',
      [`${SHIPPING}/published-language/parcel-shipped.integration-event.ts`]: 'export const ParcelShipped = 1;\n',
    });

    expect(reported(root, 'layer/domain-purity')).toEqual([
      { file: AGGREGATE, line: 2, message: 'The domain of "billing" imports the published language of "shipping".' },
    ]);
  });

  it('naming/business-name suggests the element of the collection a loop walks when it names no concept', () => {
    const root = projectWith({
      [`${BILLING}/domain/services/reminding.ts`]: lines(
        'export function remind(queue: Reminder[]): void {',
        '  for (const item of queue) {',
        '    item.send();',
        '  }',
        '}',
      ),
    });

    const { violations } = runCheck(loadProject(root), { rules: ['naming/business-name'] });

    expect(violations.map(({ message }) => message)).toEqual([
      'The loop variable "item" is named with a generic word.',
    ]);

    expect(violations[0]?.fix).toContain('Rename it after one element of queue, in the singular');
  });
});

describe('the process, tree and config rules of the checker, on a project written otherwise than the generator writes it', () => {
  it('process/sends-commands-only lets a process read the platform, and reports what it imports from infrastructure', () => {
    const root = projectWith({
      [`${BILLING}/application/processes/fulfilment.process.ts`]: lines(
        "import { loadConfig } from '@/platform/config/load-config';",
        "import { KnexInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/knex-invoice.repository';",
        'export class FulfilmentProcess {}',
      ),
    });

    expect(messages(root, 'process/sends-commands-only')).toEqual(['The process imports infrastructure/.']);
  });

  it('tree/context-doc compares no classification with a CONTEXT.md that has no such section', () => {
    const root = projectWith({
      [CONTEXT_DOC]: lines(
        '## Purpose',
        '## Ubiquitous language',
        '## Aggregates',
        '## Published events',
        '## Relationships',
      ),
    });

    expect(messages(root, 'tree/context-doc')).toEqual(['CONTEXT.md lacks the section "## Classification".']);
  });

  it('config/valid reports a module written as no object, named in no kebab-case or of an unknown classification', () => {
    const root = projectWith(
      {},
      {
        contexts: {
          billing: {
            classification: 'core',
            upstreams: [],
            modules: { calendars: 'x', 'Bad Name': {}, waitlist: { classification: 'odd' } },
          },
        },
      },
    );

    expect(messages(root, 'config/valid').filter((message) => message.startsWith('The module '))).toEqual([
      'The module "calendars" of "billing" is not written as an object.',
      'The module "Bad Name" of "billing" is not written in kebab-case.',
      'The module "waitlist" of "billing" has the classification "odd".',
    ]);
  });
});
