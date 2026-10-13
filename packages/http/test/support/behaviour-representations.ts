import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Representations } from '../../src/index.js';
import { catalogRoutes } from './catalog.js';
import type { RunningServer, StartServer } from './running-server.js';

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
}
