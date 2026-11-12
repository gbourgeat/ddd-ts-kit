import { z } from 'zod';
import { isUtf8 } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { Controller, Public, controllerRoutes, type HttpRequest, type IncomingFile, type Route } from '../../src';

const imported = zodSchema(
  z.object({ mediaType: z.string(), size: z.number(), utf8: z.boolean(), firstLine: z.string() }),
  { io: 'output' },
);

/** What a route that receives the exports of a bank declares: text in any single-byte encoding, under the names browsers give a CSV. */
export const STATEMENT_UPLOAD = {
  field: 'statement',
  maxBytes: 4_096,
  mediaTypes: ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream'],
  text: 'single-byte',
  contentRules: { 'application/vnd.ms-excel': 'text', 'application/octet-stream': 'unchecked' },
} as const;

interface Imported {
  readonly mediaType: string;
  readonly size: number;
  readonly utf8: boolean;
  readonly firstLine: string;
}

/** A controller that reads the bytes it receives as they came, and decodes them by what they are. */
export class ImportStatementController {
  async handle({ upload }: HttpRequest<{ upload: IncomingFile }>): Promise<Imported> {
    const chunks: Buffer[] = [];

    for await (const chunk of upload.stream) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }

    const bytes = Buffer.concat(chunks);
    const utf8 = isUtf8(bytes);
    const [firstLine = ''] = new TextDecoder(utf8 ? 'utf-8' : 'windows-1252').decode(bytes).split('\r\n');

    return { mediaType: upload.mediaType, size: bytes.length, utf8, firstLine };
  }
}

Controller({
  method: 'POST',
  path: '/statements',
  summary: 'Import a bank statement',
  guards: [Public],
  upload: STATEMENT_UPLOAD,
  response: { status: 201, body: imported },
})(ImportStatementController);

export function statementRoutes(): readonly Route[] {
  return controllerRoutes([new ImportStatementController()]);
}
