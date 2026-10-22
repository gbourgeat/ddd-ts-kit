import { beforeAll, describe, expect, it } from 'vitest';
import { cli, EXPLICIT_STACK, read, scaffoldEverything, tempDir, walk } from './helpers';

const BILLING = 'src/contexts/billing';
const SHIPPING = 'src/contexts/shipping';

let root: string;

beforeAll(() => {
  root = tempDir('kinds');
  scaffoldEverything(root, EXPLICIT_STACK, ['--routes', 'functions']);
});

describe('authorization and gateway kinds', () => {
  it('refuses a use case that declares neither a permission nor that it is public, and explains deny by default', () => {
    const refused = cli(root, 'generate', 'command', 'billing', 'IssueInvoice');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('declares neither a permission nor that it is public');
    expect(refused.stderr).toContain('Nothing is reachable by default');

    expect(
      cli(root, 'generate', 'command', 'billing', 'IssueInvoice', '--permission', 'invoice.issue', '--public').code,
    ).toBe(2);

    expect(
      cli(root, 'generate', 'command', 'billing', 'IssueInvoice', '--permission', 'refund.issue').stderr,
    ).toContain('"refund"');
  });

  it('declares each permission once, carries the actor in the message and lets the route name its security scheme', () => {
    expect(
      read(root, `${BILLING}/application/authorization/billing.permissions.ts`).match(
        /'invoice\.(issue|cancel|search)':/g,
      ),
    ).toHaveLength(3);

    expect(read(root, `${BILLING}/application/commands/issue-invoice/issue-invoice.command.ts`)).toContain(
      'extends AuthorizedCommand<string>',
    );

    expect(read(root, `${BILLING}/presentation/http/issue-invoice.route.ts`)).toContain("security: ['bearer'],");

    expect(read(root, `${BILLING}/presentation/http/issue-invoice.route.ts`)).toContain(
      'new IssueInvoiceCommand(actorOf(input.context.principal))',
    );

    expect(read(root, 'src/contexts/order-fulfilment/presentation/http/track-purchase-order.route.ts')).toContain(
      'security: false,',
    );

    expect(
      read(root, `${SHIPPING}/application/integration/handlers/billing-invoice-issued.integration-handler.ts`),
    ).toContain("systemActor('shipping.billing-invoice-issued')");
  });

  it('writes a policy with its spec and registers it with the policies Access asks', () => {
    expect(read(root, `${BILLING}/application/authorization/only-issuer-cancels.policy.ts`)).toContain(
      "permission: billingPermissions['invoice.cancel'],",
    );

    expect(read(root, 'src/platform/auth/authorization/access-policies.ts')).toContain('onlyIssuerCancels,');
    expect(walk(root, `${BILLING}/test/unit`)).toContain(`${BILLING}/test/unit/only-issuer-cancels.policy.spec.ts`);
  });

  it('gives a gateway its port, its in-process adapter over the published contract of the upstream, a fake and one contract suite', () => {
    const adapter = read(root, `${SHIPPING}/infrastructure/external/in-process-invoice-status.gateway.ts`);
    const module = read(root, `${SHIPPING}/shipping.module.ts`);

    expect(adapter).toContain("from '@/contexts/billing/published-language'");
    expect(adapter).toContain('TODO(platform): when billing runs as its own service');

    expect(read(root, `${BILLING}/published-language/invoice-status.contract.ts`)).toContain(
      'export abstract class InvoiceStatusContract {',
    );

    expect(read(root, `${SHIPPING}/application/ports/invoice-status-gateway.port.ts`)).toContain(
      'export abstract class InvoiceStatusGateway {',
    );

    expect(module).toContain(
      "builder.bind(InvoiceStatusContract).toValue({});\n    builder.bind(InvoiceStatusGateway).toClass(InProcessInvoiceStatusGateway, [InvoiceStatusContract]).as('gateway');",
    );

    expect(cli(root, 'generate', 'gateway', 'billing', 'shipping', 'Parcels').stderr).toContain(
      'does not declare "shipping" as an upstream',
    );
  });
});

describe('extraction and governance kinds', () => {
  it('makes a context a service: entry point, start script, compose service, deployable in the config, and a test booting each context alone', () => {
    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as {
      contexts: Record<string, { deployable?: boolean }>;
    };

    expect(read(root, 'src/apps/shipping/main.ts')).toContain('shippingModule');
    expect(read(root, 'package.json')).toContain('"start:shipping": "node dist/src/apps/shipping/main.js"');
    expect(read(root, 'docker-compose.yml')).toContain('ENTRY: dist/src/apps/shipping/main.js');
    expect(config.contexts['shipping']?.deployable).toBe(true);
    expect(config.contexts['billing']?.deployable).toBeUndefined();

    expect(read(root, 'test/architecture/extractable.spec.ts').match(/^ {2}\['[a-z-]+', \w+Module\],$/gm)).toHaveLength(
      3,
    );
  });

  it('numbers decision records and records a deviation with the entry of the config that points to it', () => {
    const created = cli(
      root,
      'generate',
      'adr',
      'Allow a longer handler',
      '--deviation',
      'rules.clean/function-size',
      '--reason',
      'One import script',
      '--json',
    ).json() as { created: string[] };

    const config = JSON.parse(read(root, 'ddd-ts-kit.config.json')) as { deviations: unknown[] };

    expect(walk(root, 'docs/adr')).toEqual([
      'docs/adr/0001-keep-shipping-in-the-same-repository-as-billing.md',
      'docs/adr/0002-allow-a-longer-handler.md',
    ]);

    expect(created.created).toEqual(['docs/adr/0002-allow-a-longer-handler.md']);
    expect(read(root, 'docs/adr/0002-allow-a-longer-handler.md')).toContain('## Removal condition');

    expect(config.deviations).toEqual([
      { what: 'rules.clean/function-size', adr: '0002', reason: 'One import script' },
    ]);
  });

  it('lists permissions, policies, gateways and what is deployable, and documents them', () => {
    const listed = cli(root, 'list').stdout;

    expect(listed).toContain('permissions: invoice.issue, invoice.cancel, invoice.search');
    expect(listed).toContain('policies: OnlyIssuerCancels');
    expect(listed).toContain('gateways: InvoiceStatus');
    expect(listed).toContain('deployable alone: yes');
    expect(read(root, `${BILLING}/CONTEXT.md`)).toContain('- `billing:invoice.cancel`');
    expect(read(root, 'docs/context-map.md')).toMatch(/\| `shipping` \|.*\| yes \|/);
    expect(read(root, 'docs/integration/README.md')).toContain('Same process, no broker');
  });
});
