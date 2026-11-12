import { Readable } from 'node:stream';
{{#if upload.isText}}
import { buffer } from 'node:stream/consumers';
{{/if}}
import { describe, expect, it } from '{{tests.module}}';
import { nestControllerRoute } from '@ddd-ts-kit/http/nest';
import { routeOf } from '@ddd-ts-kit/http/testing';
{{#if upload.isText}}
import { multipartUploads } from '@ddd-ts-kit/http/uploads';
import { KitCodes } from '@ddd-ts-kit/kernel';
{{/if}}
import { RecordingCommandBus } from '@ddd-ts-kit/kernel/testing';
{{route.messageImport}}
{{route.specImports}}
{{#if upload.isText}}

const BOUNDARY = 'boundary';
/** An export as a spreadsheet on Windows writes it: the accented letter is one byte, not UTF-8. */
const WINDOWS_1252 = Buffer.from('label;amount\r\ncaf\xe9;3,50\r\n', 'latin1');
{{#unless upload.singleByte}}
const UTF_8 = Buffer.from('label;amount\r\ncafé;3,50\r\n', 'utf8');
{{/unless}}
/** The first bytes of an Excel workbook: a binary file, whatever its name and its declared type say. */
const WORKBOOK = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
{{/if}}

describe('{{route.method}} {{route.path}}', () => {
  it('declares the file it receives, and hands it to the command as it streams', async () => {
    const commands = new RecordingCommandBus().answering({{route.input}}, () => 'file-1');
    const served = nestControllerRoute({{name.pascal}}Controller, { instanceOf: () => new {{name.pascal}}Controller(commands) });
    const file = { fileName: '{{upload.fileName}}', mediaType: '{{upload.mediaType}}', stream: Readable.from([Buffer.from({{upload.head}})]) };
    const uploads = async () => ({ fields: {}, file });
    const { route{{#if route.protected}}, caller{{/if}}, send } = routeOf(served, { uploads });

    const response = await send({{route.sentRequest}});

    expect(response.status).toBe(201);
    expect(commands.executed).toMatchObject([{ {{#if route.protected}}actor: caller, {{/if}}upload: { area: '{{name.kebab}}', received: { fileName: '{{upload.fileName}}' } } }]);
    expect(route.upload?.field).toBe('file');
  });
  {{#if upload.isText}}

  {{#if upload.singleByte}}
  it('receives byte for byte a text file that is not UTF-8, and refuses a workbook under the name of a CSV', async () => {
  {{/if}}
  {{#unless upload.singleByte}}
  it('receives a text file in UTF-8, and refuses one in another encoding or a workbook under the name of a CSV', async () => {
  {{/unless}}
    let received: Buffer = Buffer.alloc(0);

    const commands = new RecordingCommandBus().answering({{route.input}}, async (command) => {
      received = await buffer(command.upload.received.stream);

      return 'file-1';
    });

    const served = nestControllerRoute({{name.pascal}}Controller, { instanceOf: () => new {{name.pascal}}Controller(commands) });
    const { send } = routeOf(served, { uploads: multipartUploads() });
    const sent = {{route.sentRequest}};

    const taken = await send({ ...sent, ...aForm({{upload.taken}}) });
    {{#unless upload.singleByte}}
    const inAnotherEncoding = await send({ ...sent, ...aForm(WINDOWS_1252) });
    {{/unless}}
    const binary = await send({ ...sent, ...aForm(WORKBOOK) });

    expect(taken.status).toBe(201);
    expect(received).toEqual({{upload.taken}});
    {{#unless upload.singleByte}}
    expect(inAnotherEncoding).toMatchObject({ status: 415, body: { code: KitCodes.UnsupportedMediaType } });
    {{/unless}}
    expect(binary).toMatchObject({ status: 415, body: { code: KitCodes.UnsupportedMediaType } });
  });
  {{/if}}

  // TODO(domain): replace each entry below by a test of the same shape, through the same `routeOf` (`{ caller }` names another one, `anonymousActor()` of the kernel nobody).
  it.todo('answers the documented status for each error code of the use case');
});
{{#if upload.isText}}

/** A multipart form as a browser sends it: the file under the field the route declares, its bytes as they are. */
function aForm(content: Buffer) {
  const head = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="export.csv"\r\nContent-Type: text/csv\r\n\r\n`;
  const body = Buffer.concat([Buffer.from(head), content, Buffer.from(`\r\n--${BOUNDARY}--\r\n`)]);

  return {
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    stream: Readable.from([body]),
  };
}
{{/if}}
