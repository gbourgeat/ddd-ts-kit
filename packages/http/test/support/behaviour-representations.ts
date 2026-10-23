import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Representations, type ErrorContext } from '../../src';
import { catalogRoutes, failingExportRoute } from './catalog';
import type { RunningServer, StartServer } from './running-server';

/** Negotiation, streaming and XML bodies over a real connection: what each framework must not get in the way of. */
export function answersInSeveralMediaTypes(start: StartServer): void {
  describe('with the representations of the platform', () => {
    let server: RunningServer;

    beforeAll(async () => {
      server = await start(catalogRoutes, { representations: Representations.standard() });
    });

    afterAll(async () => {
      await server.close();
    });

    it('streams a CSV export', async () => {
      const response = await fetch(`${server.url}/products/export`, { headers: { accept: 'text/csv' } });

      expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
      expect((await response.text()).split('\r\n')).toHaveLength(4);
    });

    it('reads an XML body and answers in XML', async () => {
      const response = await fetch(`${server.url}/products`, {
        method: 'POST',
        headers: { 'content-type': 'application/xml', accept: 'application/xml' },
        body: '<addProduct><name>Pot</name><price>2.00</price></addProduct>',
      });

      expect(response.status).toBe(201);
      expect(await response.text()).toContain('<name>Pot</name><price>2.00</price>');
    });

    it('answers 406 when nothing it answers in is accepted', async () => {
      const response = await fetch(`${server.url}/products`, { headers: { accept: 'image/png' } });

      expect(response.status).toBe(406);
    });
  });

  describe('with a streamed list that fails once its status is sent', () => {
    const reported: ErrorContext[] = [];
    let server: RunningServer;

    beforeAll(async () => {
      server = await start([failingExportRoute(300)], {
        representations: Representations.standard(),
        onError: (_error, context) => reported.push(context),
      });
    });

    afterAll(async () => {
      await server.close();
    });

    it('cuts the response short, and reports the failure as a fault with the correlation of the request', async () => {
      const outcome = await fetch(`${server.url}/products/failing-export`, {
        headers: { accept: 'text/csv', 'x-correlation-id': 'export-1' },
      })
        .then(async (response) => response.text())
        .then(
          () => 'whole',
          () => 'cut short',
        );

      // The status may be sent or still sit in a buffer when the connection is closed: never a whole export.
      expect(outcome).toBe('cut short');
      await waitFor(() => reported.length > 0);

      expect(reported).toHaveLength(1);
      expect(reported[0]).toMatchObject({ correlationId: 'export-1', interrupted: true, problem: { status: 500 } });
    });
  });
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50 && !condition(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
