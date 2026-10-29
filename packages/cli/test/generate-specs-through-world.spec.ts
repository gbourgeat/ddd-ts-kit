import { beforeAll, describe, expect, it } from 'vitest';
import { exists, read, write } from './helpers';
import {
  APPROVE,
  billingProject,
  CANCEL,
  hint,
  ISSUE,
  REMIND,
  SEARCH,
  UNIT,
  WORLD,
  WORLD_IMPORT,
} from './support/billing-world-project';

interface Generated {
  readonly root: string;
  readonly notes: Readonly<Record<'before' | 'command' | 'query' | 'search' | 'job', string[]>>;
}

let declared: Generated | undefined;

/** On a container: a command before the world, the world, then a command, a query, a search and a job, generated once for the specs below. */
function declaredProject(): Generated {
  declared ??= generateAroundTheWorld();

  return declared;
}

function generateAroundTheWorld(): Generated {
  const { root, run } = billingProject('specs-world-declared');
  const before = run(...CANCEL).notes;

  run('generate', 'test-world', 'billing');

  return {
    root,
    notes: {
      before,
      command: run(...ISSUE).notes,
      query: run('generate', 'query', 'billing', 'GetInvoice', '--permission', 'invoice.view').notes,
      search: run(...SEARCH).notes,
      job: run(...REMIND).notes,
    },
  };
}

describe('a command, on a container, before and after the world of its context', () => {
  let root: string;
  let notes: Generated['notes'];

  beforeAll(() => {
    ({ root, notes } = declaredProject());
  });

  it('arranges a command generated before the world with the test application, and says the world would shorten it', () => {
    const spec = read(root, `${UNIT}/cancel-invoice.handler.spec.ts`);

    expect(spec).toContain(
      "const { holder, authorizer } = holdersOf(billingPermissions['invoice.cancel']);\nconst holders = authorizationModule({ authorizer });",
    );

    expect(spec).toContain(
      '  const application = createTestApplication({\n    modules: [platformTestModule, context, holders],',
    );

    expect(spec).toMatch(
      /\n\/\/ `[a-z ]+ddd-ts-kit generate test-world billing` shortens this: the specs generated after it arrange through the world\.\nfunction arrange\(\) \{/,
    );

    expect(spec).not.toContain('RoleBasedAuthorizer');
    expect(spec).not.toContain('withRole');

    expect(hint(notes.before)).toEqual([
      expect.stringMatching(
        /generate test-world billing` shortens the specs of billing: those generated after it arrange through it\.$/,
      ),
    ]);
  });

  it('arranges a command generated after the world through it, with the permission, the prefix of its identifiers and the same assertions', () => {
    const spec = read(root, `${UNIT}/issue-invoice.handler.spec.ts`);

    expect(spec).toContain(WORLD_IMPORT);
    expect(spec).toContain("const { holder, authorizer } = holdersOf(billingPermissions['invoice.issue']);");

    expect(spec).toContain(
      "async function arrange() {\n  return aBillingWorld({ modules: [holders], idPrefix: 'invoice' });\n}",
    );

    expect(spec).toContain('    const { application, invoiceRepository } = await arrange();');
    expect(spec).toContain("rejects.toMatchObject({ code: 'FORBIDDEN' })");
    expect(spec).toContain("  it.todo('applies the business decision to the invoice');");

    for (const gone of [
      'createTestApplication',
      'platformTestModule',
      'FakeInvoiceRepository',
      'contextModule',
      '//',
    ]) {
      expect(spec.replace(/\/\/ TODO\(domain\).*\n/, ''), gone).not.toContain(gone);
    }

    expect(hint(notes.command)).toEqual([]);
  });
});

describe('a query and a job, on a container, after the world of their context', () => {
  let root: string;
  let notes: Generated['notes'];

  beforeAll(() => {
    ({ root, notes } = declaredProject());
  });

  it('hands the world the fake of the reader of a query, which answers what the spec gives it', () => {
    const query = read(root, `${UNIT}/get-invoice.handler.spec.ts`);
    const search = read(root, `${UNIT}/search-invoices.handler.spec.ts`);

    expect(query).toContain("import { fake } from '@ddd-ts-kit/di';");

    expect(query).toContain(
      '  const { application } = await aBillingWorld({\n    modules: [holders],\n    fakes: [fake(GetInvoiceReader, new FakeGetInvoiceReader(answer))],\n  });\n\n  return application;',
    );

    expect(query).toContain('    const application = await arrange(answer);');
    expect(search).toContain('fakes: [fake(SearchInvoicesReader, new FakeSearchInvoicesReader(lines))]');
    expect(search).toContain(WORLD_IMPORT);
    expect([...hint(notes.query), ...hint(notes.search)]).toEqual([]);
  });

  it('gives the system actor of a job the permission of its command through the world', () => {
    const spec = read(root, `${UNIT}/remind-overdue.job.spec.ts`);

    expect(spec).toContain(
      "const { authorizer } = holdersOf(billingPermissions['invoice.cancel']);\nconst authorization = authorizationModule({ authorizer });",
    );

    expect(spec).toContain('  const { application } = await aBillingWorld({ modules: [authorization] });');
    expect(spec).not.toContain('createTestApplication');
    expect(hint(notes.job)).toEqual([]);
  });

  it('writes no world nobody asked for', () => {
    const fresh = billingProject('specs-world-not-written');

    fresh.run(...ISSUE);

    expect(exists(fresh.root, WORLD)).toBe(false);
  });
});

describe('a world that lacks what a spec needs', () => {
  it('leaves a command on a repository the world does not build to the test application, and says how to add it', () => {
    const { root, run } = billingProject('specs-world-no-repository');

    run('generate', 'test-world', 'billing');
    run('generate', 'aggregate', 'billing', 'Refund');

    const generated = run(...APPROVE);

    const spec = read(root, `${UNIT}/approve-refund.handler.spec.ts`);

    expect(spec).toContain('createTestApplication({');

    expect(spec).toMatch(
      /\n\/\/ The world of billing gives no refundRepository: `[a-z ]+ddd-ts-kit generate test-world billing --force` writes it again\.\nfunction arrange/,
    );

    expect(hint(generated.notes)).toEqual([
      expect.stringMatching(
        /^The world of billing gives no refundRepository: the spec arranges without it\. `[a-z ]+ddd-ts-kit generate test-world billing --force` writes it again, for the specs generated after\.$/,
      ),
    ]);
  });

  it('leaves a query to the test application when the world, written before it took fakes, does not take them', () => {
    const { root, run } = billingProject('specs-world-older');

    run('generate', 'test-world', 'billing');

    write(root, WORLD, read(root, WORLD).replace('\n  readonly fakes?: readonly Override[];', ''));

    const generated = run('generate', 'query', 'billing', 'GetInvoice', '--permission', 'invoice.view');

    expect(read(root, `${UNIT}/get-invoice.handler.spec.ts`)).toContain('  return createTestApplication({');

    expect(hint(generated.notes)).toEqual([
      expect.stringContaining('The world of billing takes no fakes: the spec arranges without it.'),
    ]);
  });
});

describe('the specs of billing, wired by hand, after its world', () => {
  it('builds the handler on the buses and the fakes of the world, guarded in the spec', () => {
    const { root, run } = billingProject('specs-world-buses', '--di', 'manual');

    // The world changes a line there: no hint, no comment, until a world exists.
    expect(hint(run(...CANCEL).notes)).toEqual([]);
    run('generate', 'test-world', 'billing');
    run(...ISSUE);
    run(...SEARCH);
    run(...REMIND);

    const before = read(root, `${UNIT}/cancel-invoice.handler.spec.ts`);

    expect(before).not.toContain('test-world');
    const command = read(root, `${UNIT}/issue-invoice.handler.spec.ts`);

    expect(before).toContain("createTestBuses({ idPrefix: 'invoice' })");
    expect(command).toContain(WORLD_IMPORT);

    expect(command).toContain(
      "holdersOf(billingPermissions['invoice.issue']);\n\nconst holders = authorizationMiddleware({\n  authorizer,",
    );

    expect(command).toContain(
      "  const { commandBus, clock, ids, domainEvents, invoiceRepository } = await aBillingWorld({ idPrefix: 'invoice' });\n  const handler = new IssueInvoiceHandler(invoiceRepository, ids, clock);\n\n  commandBus.use(holders).register(IssueInvoiceCommand, handler);",
    );

    expect(command).not.toContain('createTestBuses');

    expect(read(root, `${UNIT}/search-invoices.handler.spec.ts`)).toContain(
      '  const { queryBus, clock } = await aBillingWorld();',
    );

    expect(read(root, `${UNIT}/remind-overdue.job.spec.ts`)).toContain(
      '  const { commandBus } = await aBillingWorld();',
    );
  });
});
