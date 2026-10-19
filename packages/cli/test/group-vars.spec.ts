import { describe, expect, it } from 'vitest';
import { groupVars } from '../src/generate/kinds/route/group-vars.js';
import { toName } from '../src/naming/index.js';

const PARENT = { className: 'AdminRoutes', specifier: '@/platform/http/admin-routes.route-group' };

describe('what the template of a route group reads', () => {
  it('opens a public group to anyone, with its tag and no refusal of a forbidden caller', () => {
    expect(groupVars({ name: toName('Catalog'), prefix: '/catalog', tag: 'catalog', access: 'public' })).toMatchObject({
      imports: "import { Public, RouteGroup } from '@ddd-ts-kit/http';",
      options: "prefix: '/catalog', tags: ['catalog'], guards: [Public]",
    });
  });

  it('lets a group that refines another inherit its guard, its tag and its errors', () => {
    const vars = groupVars({ name: toName('AdminReports'), prefix: '', tag: '', parent: PARENT, access: 'inherited' });

    expect(vars['options']).toBe('parent: AdminRoutes');

    expect(vars['imports']).toBe(
      [
        "import { RouteGroup } from '@ddd-ts-kit/http';",
        "import { AdminRoutes } from '@/platform/http/admin-routes.route-group';",
      ].join('\n'),
    );
  });

  it('asks a signed-in caller of a group of its own, and refuses a forbidden one', () => {
    expect(
      groupVars({ name: toName('Billing'), prefix: '/billing', tag: 'billing', access: 'authenticated' }),
    ).toMatchObject({
      options: "prefix: '/billing', tags: ['billing'], guards: [Authenticated], errors: ['FORBIDDEN']",
    });
  });
});
