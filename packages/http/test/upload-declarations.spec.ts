import 'reflect-metadata';
import { Controller as NestController, Post } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { Controller, Public, defineRoute, type UploadSpec } from '../src';
import { KitRoute, KitRoutes, Upload, nestControllerRoute } from '../src/nest';
import { generateOpenApi } from '../src/openapi';
import { openApiOptions } from './support/open-api-options';
import { STATEMENT_UPLOAD, statementRoutes } from './support/statement-desk';

const route = { method: 'POST', path: '/statements', summary: 'Import', guards: [Public] } as const;
const answer = { response: { status: 201 } } as const;

function declaring(upload: UploadSpec): () => void {
  return () => {
    class ImportExportController {
      handle(): void {}
    }

    Controller({ ...route, ...answer, upload })(ImportExportController);
  };
}

describe('an upload whose media types could receive no file', () => {
  it('is refused when its controller is declared, with the type and the way to state its rule', () => {
    const declare = declaring({ field: 'file', maxBytes: 64, mediaTypes: ['text/csv', 'application/vnd.ms-excel'] });

    expect(declare).toThrow(
      /Controller ImportExportController declares an upload it cannot receive: "application\/vnd\.ms-excel" has no content rule/,
    );

    expect(declare).toThrow(/State one in `contentRules`: 'text' \(held to the text rule\) or 'unchecked'/);
  });

  it('is refused for each such type at once: the browser names of a CSV, bytes of any kind, a family nobody knows', () => {
    const mediaTypes = ['application/csv', 'application/vnd.ms-excel', 'application/octet-stream', 'video/*', '*/*'];
    const declare = declaring({ field: 'file', maxBytes: 64, mediaTypes });

    expect(declare).toThrow(/"application\/vnd\.ms-excel" has no content rule/);
    expect(declare).toThrow(/"application\/octet-stream" has no content rule/);
    expect(declare).toThrow(/"video\/\*" has no content rule/);
    expect(declare).toThrow(/"\*\/\*" is neither a media type nor a family/);
    expect(declare).not.toThrow(/"application\/csv"/);
  });

  it('is accepted once the route states the rule of each, and refused for a rule that does nothing', () => {
    expect(declaring(STATEMENT_UPLOAD)).not.toThrow();

    expect(
      declaring({
        field: 'file',
        maxBytes: 64,
        mediaTypes: ['application/pdf'],
        contentRules: { 'application/pdf': 'unchecked' },
      }),
    ).toThrow(/states "application\/pdf", which the kit already verifies \(signature\)/);
  });

  it('is refused on a function route as well, when it is defined', () => {
    const upload = { field: 'file', maxBytes: 64, mediaTypes: ['application/octet-stream'] };

    const spec = {
      ...route,
      operationId: 'importExport',
      security: false,
      responses: { 201: { description: 'Imported.' } },
    } as const;

    expect(() => defineRoute({ ...spec, upload }, () => ({ status: 201 }))).toThrow(
      /Route "importExport" declares an upload it cannot receive: "application\/octet-stream" has no content rule/,
    );

    const stated = { ...upload, contentRules: { 'application/octet-stream': 'unchecked' } } as const;

    expect(defineRoute({ ...spec, upload: stated }, () => ({ status: 201 })).upload).toEqual(stated);
  });

  it('is refused on a Nest controller when its routes are built', () => {
    class Importing {
      receive(): void {}
    }

    NestController('statements')(Importing);
    KitRoutes({ guards: [Public] })(Importing);

    Reflect.decorate(
      [Post(), KitRoute({ upload: { field: 'file', maxBytes: 64, mediaTypes: ['application/vnd.ms-excel'] } })],
      Importing.prototype,
      'receive',
      { value: Importing.prototype.receive },
    );

    Upload()(Importing.prototype, 'receive', 0);

    expect(() => nestControllerRoute(Importing, { instanceOf: () => new Importing() })).toThrow(
      /declares an upload it cannot receive: "application\/vnd\.ms-excel" has no content rule/,
    );
  });
});

describe('the contract of an upload that takes single-byte text and unchecked bytes', () => {
  it('says the text it takes and the types it does not check', () => {
    const document = generateOpenApi(openApiOptions(statementRoutes()));
    const body = document.paths['/statements']?.['post'];

    expect(body).toMatchObject({
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              properties: {
                statement: {
                  description:
                    'The file: text/csv, application/vnd.ms-excel, application/octet-stream, at most 4096 bytes, its type checked on its content. Text is UTF-8 or a single-byte encoding such as Windows-1252. Taken as sent, its content not checked: application/octet-stream.',
                  'x-text': 'single-byte',
                  'x-content-rules': { 'application/vnd.ms-excel': 'text', 'application/octet-stream': 'unchecked' },
                },
              },
            },
          },
        },
      },
    });
  });
});
