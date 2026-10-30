import { beforeAll, describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const HTTP = 'src/contexts/billing/presentation/http';

/** A route group whose parent no file of the context declares: it refines nothing. */
const ORPHAN_GROUP = `import { RouteGroup } from '@ddd-ts-kit/http';

@RouteGroup({ prefix: '/admin', parent: BackOfficeRoutes, tags: ['billing'] })
export class AdminRoutes {}
`;

/** A route group left open: its decorator never closes, so it declares nothing the kit can read. */
const UNCLOSED_GROUP = `import { RouteGroup } from '@ddd-ts-kit/http';

@RouteGroup({ prefix: '/broken'
export class BrokenRoutes {}
`;

/** A controller that sends a query built elsewhere: the use case is read from its class name, the kind from the bus it holds. */
const CONTROLLER = `import { Controller } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { AdminRoutes } from '@/contexts/billing/presentation/http/admin.routes';
import { searchInvoicesQueryOf } from './search-invoices.mapper';

@Controller({
  group: AdminRoutes,
  method: 'GET',
  path: '/invoices',
  response: { status: 200, description: 'The invoices.' },
  errors: [],
})
export class SearchInvoicesController {
  constructor(private readonly queries: QueryBus) {}

  async handle(): Promise<void> {
    await this.queries.ask(searchInvoicesQueryOf());
  }
}
`;

describe('describe, the routes written by hand', () => {
  let root: string;

  beforeAll(() => {
    root = initProject('--context', 'billing:core');

    write(root, `${HTTP}/admin.routes.ts`, ORPHAN_GROUP);
    write(root, `${HTTP}/broken.routes.ts`, UNCLOSED_GROUP);
    write(root, `${HTTP}/invoices/search-invoices/search-invoices.controller.ts`, CONTROLLER);

    write(
      root,
      `${HTTP}/invoices/search-invoices/search-invoices.mapper.ts`,
      'export const searchInvoicesQueryOf = () => ({});\n',
    );
  });

  it('reads a controller that builds no message as the use case its name says, a query by the bus it asks', () => {
    const described = cli(root, 'describe', 'billing', '--json');

    expect(described.code, described.stderr).toBe(0);

    expect(jsonAt(described.json(), 'routes')).toEqual([
      expect.objectContaining({
        method: 'GET',
        path: '/admin/invoices',
        operationId: 'searchInvoices',
        group: 'AdminRoutes',
        useCase: 'SearchInvoices',
        permission: '',
      }),
    ]);
  });

  it('gives a group whose parent is unknown its own prefix alone, and passes over a decorator left open', () => {
    expect(cli(root, 'describe', 'billing').stdout).not.toContain('BrokenRoutes');
    expect(cli(root, 'describe', 'billing').stdout).toContain('/admin/invoices');
  });
});
