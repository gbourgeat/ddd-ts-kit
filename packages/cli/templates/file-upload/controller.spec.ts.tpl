import { Readable } from 'node:stream';
import { describe, expect, it } from '{{tests.module}}';
import { controllerRoute, executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus{{#if route.protected}}, type Actor{{/if}} } from '@ddd-ts-kit/kernel';
{{route.messageImport}}
{{route.specImports}}

{{#if route.protected}}
const caller: Actor = { id: 'user-1', type: 'user', roles: [], attributes: {} };

{{/if}}
describe('{{route.method}} {{route.path}}', () => {
  it('declares the file it receives, and hands it to the command as it streams', async () => {
    const received: string[] = [];

    const commands = new InMemoryCommandBus().register({{route.input}}, {
      execute: async ({ file }) => {
        received.push(file.fileName);

        return 'file-1';
      },
    });

    const route = controllerRoute(new {{name.pascal}}Controller(commands));
    const file = { fileName: 'scan.pdf', mediaType: 'application/pdf', stream: Readable.from([Buffer.from('%PDF-')]) };

    const response = await executeRoute(
      route,
      { params: {{route.sampleParams}}, query: {}, headers: {}, body: {}, raw: undefined },
      {
        validateResponses: true,
        uploads: async () => ({ fields: {}, file }),
{{#if route.protected}}
        resolvePrincipal: () => caller,
{{/if}}
      },
    );

    expect(response.status).toBe(201);
    expect(received).toEqual(['scan.pdf']);
    expect(route.upload?.field).toBe('file');
  });

  // TODO(domain): replace each entry below by a test of the contract a client relies on.
  it.todo('answers the documented status for each error code of the use case');
});
