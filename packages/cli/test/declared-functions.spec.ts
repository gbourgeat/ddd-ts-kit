import { describe, expect, it } from 'vitest';
import { read, scaffoldEverything, tempDir } from './helpers';

const BILLING = 'src/contexts/billing';

describe('a declared context whose routes are functions', () => {
  it('keeps the list of routes of a project that writes its routes as functions', () => {
    const functions = tempDir('declared-functions');

    scaffoldEverything(functions, undefined, ['--routes', 'functions']);

    expect(read(functions, `${BILLING}/presentation/http/billing.routes.ts`)).toContain(
      'issueInvoiceRoute(commands),\n    cancelInvoiceRoute(commands),\n    searchInvoicesRoute(queries),',
    );

    expect(read(functions, 'src/platform/composition/compose-application.ts')).toContain(
      '    billingRoutes,\n    shippingRoutes,\n    orderFulfilmentRoutes,',
    );

    expect(read(functions, 'src/apps/shipping/main.ts')).toContain(
      "{ modules: [contextModule('shipping', shippingDeclarations)], routes: [shippingRoutes] },",
    );

    expect(read(functions, `${BILLING}/billing.declarations.ts`)).not.toContain('presentation/');
  });
});
