import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';
import { source } from './source';

const { BILLING, EVENT_HANDLER, EVENT_HANDLER_SPEC } = PATHS;
const RELATE = 'src/platform/auth/relationships/relate-system-actors.ts';
const ISSUE_COMMAND = `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`;
const REBAC = { [CONFIG_FILE]: config({ stack: { authz: 'rebac' } }) };

const rule = 'authz/system-actor-granted';

export const AUTHZ_SYSTEM_ACTOR_GRANTED_FIXTURES: readonly Fixture[] = [
  {
    ruleId: rule,
    name: 'a handler whose system actor is related to its context',
    expect: 'pass',
    files: acting(
      handler("systemActor('billing.invoice-issued')"),
      relationships('system:system:billing.invoice-issued'),
    ),
  },
  {
    ruleId: rule,
    name: 'a handler named by its class, related under that name',
    expect: 'pass',
    files: acting(
      handler('systemActor(InvoiceIssuedEventHandler.name)'),
      relationships('system:system:InvoiceIssuedEventHandler'),
    ),
  },
  {
    ruleId: rule,
    name: 'a handler that sends a public command needs no grant',
    expect: 'pass',
    files: acting(handler("systemActor('billing.invoice-issued')"), relationships(), { isPublic: true }),
  },
  {
    ruleId: rule,
    name: 'a system actor whose name the checker cannot read',
    expect: 'pass',
    files: acting(handler('systemActor(actorName)'), relationships()),
  },
  {
    ruleId: rule,
    name: 'a handler without a grant, in a project with an authorizer of its own',
    expect: 'pass',
    files: {
      ...acting(handler("systemActor('billing.invoice-issued')"), relationships()),
      'src/platform/auth/authorization/create-authorizer.ts': source(
        "import { MyAuthorizer } from '@/platform/auth/authorization/my.authorizer.js';",
        '',
        'export const createAuthorizer = () => new MyAuthorizer();',
      ),
      'src/platform/auth/authorization/my.authorizer.ts': 'export class MyAuthorizer {}\n',
    },
  },
  {
    ruleId: rule,
    name: 'a handler without a grant, in a project whose rights are roles',
    expect: 'pass',
    files: {
      ...acting(handler("systemActor('billing.invoice-issued')"), relationships()),
      [CONFIG_FILE]: config({ stack: { authz: 'rbac' } }),
    },
  },
  {
    ruleId: rule,
    name: 'a handler whose system actor no relationship names',
    expect: { file: EVENT_HANDLER },
    files: acting(handler("systemActor('billing.invoice-issued')"), relationships()),
  },
  {
    ruleId: rule,
    name: 'a handler whose actor is named without its type, which the authorizer never matches',
    expect: { file: EVENT_HANDLER },
    files: acting(handler("systemActor('billing.invoice-issued')"), relationships('system:billing.invoice-issued')),
  },
  {
    ruleId: rule,
    name: 'a handler whose system actor is named by another actor only',
    expect: { file: EVENT_HANDLER },
    files: acting(handler('systemActor(InvoiceIssuedEventHandler.name)'), relationships('system:system:InvoiceIssued')),
  },
];

function acting(handlerSource: string, relate: string, { isPublic = false } = {}): FixtureFiles {
  return project(
    {
      [EVENT_HANDLER]: handlerSource,
      [EVENT_HANDLER_SPEC]: SAMPLES.SPEC,
      [RELATE]: relate,
      [ISSUE_COMMAND]: source(
        "import { AuthorizedCommand } from '@ddd-ts-kit/kernel';",
        "import { Public, Requires } from '@ddd-ts-kit/kernel/declarations';",
        "import { billingPermissions } from '@/contexts/billing/billing.permissions.js';",
        '',
        isPublic ? '@Public()' : "@Requires(billingPermissions['invoice.issue'])",
        'export class IssueInvoiceCommand extends AuthorizedCommand<void> {}',
      ),
    },
    REBAC,
  );
}

function handler(actor: string): string {
  return source(
    "import { systemActor, type CommandBus } from '@ddd-ts-kit/kernel';",
    "import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';",
    '',
    'export class InvoiceIssuedEventHandler {',
    '  constructor(private readonly commands: CommandBus) {}',
    '',
    '  async handle(): Promise<void> {',
    `    await this.commands.execute(new IssueInvoiceCommand(${actor}));`,
    '  }',
    '}',
  );
}

function relationships(...subjects: readonly string[]): string {
  return source(
    "import type { RelationTuple } from '@ddd-ts-kit/auth/rebac';",
    '',
    'const systemRelationships: readonly RelationTuple[] = [',
    ...subjects.map((subject) => `  { object: 'context:billing', relation: 'operator', subject: '${subject}' },`),
    '];',
    '',
    'export const grants = systemRelationships;',
  );
}
