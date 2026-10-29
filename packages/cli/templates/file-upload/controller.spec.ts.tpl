import { Readable } from 'node:stream';
import { describe, expect, it } from '{{tests.module}}';
import { routeOf } from '@ddd-ts-kit/http/testing';
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
{{route.messageImport}}
{{route.specImports}}

describe('{{route.method}} {{route.path}}', () => {
  it('declares the file it receives, and hands it to the command as it streams', async () => {
    const commands = new RecordingCommandBus().answering({{route.input}}, () => 'file-1');
    const file = { fileName: 'scan.pdf', mediaType: 'application/pdf', stream: Readable.from([Buffer.from('%PDF-')]) };
    const uploads = async () => ({ fields: {}, file });
    const { route{{#if route.protected}}, caller{{/if}}, send } = routeOf(new {{name.pascal}}Controller(commands), { uploads });

    const response = await send({{route.sentRequest}});

    expect(response.status).toBe(201);
    expect(commands.executed).toMatchObject([{ {{#if route.protected}}actor: caller, {{/if}}upload: { area: '{{name.kebab}}', received: { fileName: 'scan.pdf' } } }]);
    expect(route.upload?.field).toBe('file');
  });

  // TODO(domain): replace each entry below by a test of the same shape, through the same `routeOf` (`{ caller }` names another one, `anonymousActor()` of the kernel nobody).
  it.todo('answers the documented status for each error code of the use case');
});
