import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write, type CliResult } from './helpers';
import { failure as refusal, report } from './reports';
import { jsonAt } from './support/json-at';

const SHIPPING = 'src/contexts/shipping';
const HANDLERS = `${SHIPPING}/application/integration/handlers`;
const ISSUED = `${HANDLERS}/billing-invoice-issued.integration-handler.ts`;
const CANCELLED = `${HANDLERS}/billing-invoice-cancelled.integration-handler.ts`;
const SPEC = 'test/e2e/ship-parcel.e2e.spec.ts';
const SUPPORT = 'test/e2e/support/start-application.ts';

let root: string;

const generate = (...args: string[]): CliResult => cli(root, 'generate', ...args, '--json');

function failure(result: CliResult): { message: string; fix: string } {
  expect(result.code).toBe(2);

  return refusal(result);
}

/** The handler sends the command of the use case, as its TODO(domain) asks once filled. */
function sendsShipParcel(file: string): void {
  write(
    root,
    file,
    read(root, file).replace(
      /async handle\(event: (\w+)\): Promise<void> \{\n.*\n {2}\}/,
      'async handle(event: $1): Promise<void> {\n    await this.commands.execute(new ShipParcelCommand(this.actor, { parcelId: event.id }));\n  }',
    ),
  );
}

function removed(file: string): void {
  fs.rmSync(path.join(root, file), { force: true });
}

/** Two contexts, billing upstream of shipping, a handler of billing.invoice.issued in shipping and the command it is to send. */
function scaffold(...init: string[]): string {
  const project = tempDir('e2e-reaction');

  const steps = [
    ['init', ...init],
    [
      'generate',
      'context',
      'billing',
      '--classification',
      'core',
      '--term',
      'Invoice=A request for payment',
      '--term',
      'Issue=To make it final',
      '--term',
      'Cancel=To void it before payment',
    ],
    [
      'generate',
      'context',
      'shipping',
      '--classification',
      'supporting',
      '--upstream',
      'billing:customer-supplier',
      '--term',
      'Parcel=What leaves the warehouse',
      '--term',
      'Ship=To hand a parcel to a carrier',
    ],
    ['generate', 'aggregate', 'billing', 'Invoice'],
    ['generate', 'integration-event', 'billing', 'Invoice', 'Issued'],
    ['generate', 'integration-event', 'billing', 'Invoice', 'Cancelled'],
    ['generate', 'integration-handler', 'shipping', 'billing', 'billing.invoice.issued'],
    ['generate', 'command', 'shipping', 'ShipParcel', '--permission', 'parcel.ship'],
    ['generate', 'query', 'shipping', 'TrackParcel', '--public', '--term', 'Track=To follow a parcel'],
  ];

  for (const step of steps) {
    const result = cli(project, ...step);

    expect(result.code, `${step.join(' ')}: ${result.stderr}`).toBe(0);
  }

  return project;
}

beforeAll(() => {
  root = scaffold();
});

describe('generate e2e for a use case an integration event starts', () => {
  it('refuses a use case no route and no handler reach, and names the route and --event', () => {
    const { message, fix } = failure(generate('e2e', 'shipping', 'ShipParcel'));

    expect(message).toContain('no integration event handler of it sends ShipParcelCommand');
    expect(message).toContain('and no job of it does');
    expect(fix).toContain('ddd-ts-kit generate route shipping ShipParcel');
    expect(fix).toContain('ddd-ts-kit generate job shipping <JobName> --every <duration> --command ShipParcel');
    expect(fix).toContain('--event <context>.<aggregate>.<fact> (handled here: billing.invoice.issued)');
  });

  it('publishes the event of the one handler that sends the command, built from the declaration of its upstream', () => {
    sendsShipParcel(ISSUED);

    const result = generate('e2e', 'shipping', 'ShipParcel');
    const spec = read(root, SPEC);

    expect(result.code).toBe(0);
    expect(spec).toContain("import { invoiceIssuedV1 } from '@/contexts/billing/published-language';");
    expect(spec).toContain("const event = invoiceIssuedV1.create({ invoiceId: 'invoice-1' }, meta);");

    expect(spec).toContain(
      'await expect(application.publish([event])).resolves.toBeUndefined();\n    await application.settled();',
    );

    expect(spec).toContain(
      'BillingInvoiceIssuedIntegrationHandler sends its command when billing publishes billing.invoice.issued',
    );

    expect(spec).toContain("it.todo('has the same outcome when billing.invoice.issued is delivered twice');");
    expect(spec).not.toContain('expectStatus');
  });

  it('points to the routes that read what followed, when the context has some', () => {
    expect(
      cli(root, 'generate', 'route', 'shipping', 'TrackParcel', '--method', 'GET', '--path', '/parcels/:parcelId').code,
    ).toBe(0);

    removed(SPEC);

    generate('e2e', 'shipping', 'ShipParcel');

    expect(read(root, SPEC)).toContain('the answers of GET /parcels/:parcelId, then the integration events');

    expect(read(root, SPEC)).toContain(
      `it.todo('lets a client observe the outcome of "ship parcel" through the API');`,
    );
  });

  it('asks for --event when handlers of several events send the command, and follows it', () => {
    expect(cli(root, 'generate', 'integration-handler', 'shipping', 'billing', 'billing.invoice.cancelled').code).toBe(
      0,
    );

    sendsShipParcel(CANCELLED);
    removed(SPEC);

    const { message, fix } = failure(generate('e2e', 'shipping', 'ShipParcel'));

    expect(message).toContain('Several integration event handlers of "shipping" send ShipParcelCommand');
    expect(fix).toContain('ddd-ts-kit generate e2e shipping ShipParcel --event <eventType>');
    expect(fix).toContain('billing.invoice.cancelled, billing.invoice.issued');

    expect(generate('e2e', 'shipping', 'ShipParcel', '--event', 'billing.invoice.cancelled').code).toBe(0);
    expect(read(root, SPEC)).toContain('const event = invoiceCancelledV1.create(');
  });

  it('refuses an event no handler of the context receives, or a use case with no command', () => {
    removed(SPEC);

    const unhandled = failure(generate('e2e', 'shipping', 'ShipParcel', '--event', 'billing.invoice.paid'));

    expect(unhandled.message).toBe('No integration event handler of "shipping" receives billing.invoice.paid.');
    expect(unhandled.fix).toContain('ddd-ts-kit generate integration-handler shipping billing billing.invoice.paid');

    const commandless = failure(generate('e2e', 'shipping', 'ReturnParcel', '--event', 'billing.invoice.issued'));

    expect(commandless.fix).toContain('ddd-ts-kit generate command shipping ReturnParcel');
  });

  it('notes a support written before publish existed', () => {
    expect(read(root, SUPPORT)).toContain('publish: (events) => application.eventBus.publish(events),');

    write(root, SUPPORT, read(root, SUPPORT).replace(/^ *publish\(.*$/gm, ''));
    removed(SPEC);

    const { notes } = report(generate('e2e', 'shipping', 'ShipParcel', '--event', 'billing.invoice.issued'));

    expect(notes).toContainEqual(expect.stringContaining(`${SUPPORT} has no publish(events)`));
  });
});

describe('generate e2e behind a broker, the handler subscribed in the module file of its context', () => {
  const BEHIND_RABBITMQ = ['--http', 'fastify', '--di', 'manual', '--orm', 'knex', '--broker', 'rabbitmq'];

  it('finds the event the handler consumes, and describe names it', () => {
    const project = scaffold(...BEHIND_RABBITMQ);

    expect(cli(project, 'generate', 'e2e', 'shipping', 'ShipParcel', '--event', 'billing.invoice.issued').code).toBe(0);
    expect(read(project, SPEC)).toContain('const event = invoiceIssuedV1.create(');

    expect(jsonAt(cli(project, 'describe', 'shipping', '--json').json(), 'consumedEvents')).toEqual([
      expect.objectContaining({ type: 'billing.invoice.issued', version: 1, from: 'billing' }),
    ]);
  });
});

describe('generate e2e for a use case only a job starts', () => {
  it('runs the job through the support, waits for settled() and leaves the then to fill', () => {
    const project = scaffold();

    const job = cli(
      project,
      'generate',
      'job',
      'shipping',
      'ShipDaily',
      '--every',
      '1d',
      '--command',
      'ShipParcel',
      '--term',
      'Daily=Once a day',
    );

    expect(job.code, job.stderr).toBe(0);

    const result = cli(project, 'generate', 'e2e', 'shipping', 'ShipParcel', '--json');
    const spec = read(project, SPEC);

    expect(result.code, result.stderr).toBe(0);
    expect(spec).toContain("await application.runJob('shipping.ship-daily');\n    await application.settled();");
    expect(spec).toContain('when shipping.ship-daily is due');
    expect(spec).toContain('TODO(domain): assert what a client or another context observes');
    expect(spec).not.toContain('application.publish');
  });

  it('notes a support written before runJob existed', () => {
    const project = scaffold();

    cli(
      project,
      'generate',
      'job',
      'shipping',
      'ShipDaily',
      '--every',
      '1d',
      '--command',
      'ShipParcel',
      '--term',
      'Daily=Once a day',
    );

    const support = read(project, SUPPORT);

    expect(support).toContain('runJob: (name) => runJob(application.jobs, name),');

    write(project, SUPPORT, support.replace(/^ *runJob\(.*$/gm, ''));

    const { notes } = report(cli(project, 'generate', 'e2e', 'shipping', 'ShipParcel', '--json'));

    expect(notes).toContainEqual(expect.stringContaining(`${SUPPORT} has no runJob(name)`));
  });
});
