import { describe, expect, it } from 'vitest';
import { subjectModule } from '../src/model-modules';
import { cli, write } from './helpers';
import { initProject } from './support/init-project';
import { expectOk } from './support/expect-ok';

describe('what a file of the tests is named after', () => {
  it('is nothing for a file that is neither a spec, a builder nor a fake: a world stays with what the modules share', () => {
    const production = [{ path: 'domain/aggregates/invoice.aggregate.ts', module: 'invoices' }];

    expect(subjectModule('test/worlds/billing.world.ts', production)).toBeUndefined();
    expect(subjectModule('test/builders/invoice.builder.ts', production)).toBe('invoices');
  });
});

describe('controllers, in a context divided into modules', () => {
  it('turns no function route left in shared/, and names the move that gives it a module', () => {
    const root = initProject('--routes', 'functions', '--context', 'billing:core');

    expectOk(
      cli(
        root,
        'generate',
        'module',
        'billing',
        'invoices',
        '--purpose',
        'The invoices.',
        '--term',
        'Invoice=A request for payment',
        '--term',
        'Invoices=Every invoice',
      ),
    );

    write(
      root,
      'src/contexts/billing/shared/presentation/http/ping.route.ts',
      "import { defineRoute, type Route } from '@ddd-ts-kit/http';\n\nexport function pingRoute(): Route {\n  return defineRoute({ method: 'POST', path: '/', operationId: 'ping', summary: 'Ping', responses: { 204: { description: 'Done.' } }, security: ['bearer'] }, async () => ({ status: 204 }));\n}\n",
    );

    const refused = cli(root, 'controllers');

    expect(refused.code).toBe(1);

    expect(refused.stdout).toContain(
      'a route belongs to a module, and this one sits in shared/: move it first with `ddd-ts-kit move-to-module billing <module> shared/presentation/http/ping.route.ts`.',
    );
  });
});
