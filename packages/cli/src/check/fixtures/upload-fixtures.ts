import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { source } from './source';

const { BILLING, ROUTE } = PATHS;
const CONTROLLER = `${BILLING}/presentation/http/statements/import-statement/import-statement.controller.ts`;
const SPEC = `${BILLING}/test/unit/import-statement.controller.spec.ts`;
const RULE = 'files/upload-content-rule';

/** A controller of billing that declares `upload`, written as the generator writes one. */
const controller = (...upload: string[]): string =>
  source(
    "import { Controller, Public, type HttpRequest, type IncomingFile } from '@ddd-ts-kit/http';",
    '',
    '@Controller({',
    "  method: 'POST',",
    "  path: '/statements',",
    "  summary: 'Import a statement',",
    '  guards: [Public],',
    ...upload,
    '  response: { status: 201 },',
    '})',
    'export class ImportStatementController {',
    '  async handle(request: HttpRequest<{ upload: IncomingFile }>): Promise<void> {',
    '    await request.upload.stream.toArray();',
    '  }',
    '}',
  );

const route = (upload: string): string =>
  source(
    "import { defineRoute } from '@ddd-ts-kit/http';",
    '',
    'export const importStatementRoute = defineRoute(',
    `  { method: 'POST', path: '/statements', operationId: 'importStatement', ${upload}, security: false, responses: { 201: {} } },`,
    '  importStatement,',
    ');',
  );

/** Declarations a reading of the text cannot judge: the rule is silent, the declaration of the route speaks. */
const UNREAD: readonly (readonly [what: string, upload: string])[] = [
  ['a spread of another declaration', "  upload: { ...BASE, mediaTypes: ['video/mp4'] },"],
  [
    'a spread in its media types',
    "  upload: { field: 'file', maxBytes: 1_000, mediaTypes: [...DOCUMENTS, 'video/mp4'] },",
  ],
  ['no media types', "  upload: { field: 'file' },"],
];

export const UPLOAD_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'an upload of formats the kit recognises, of text, and of a family one of whose types it knows',
    expect: 'pass',
    files: project({
      [CONTROLLER]: controller(
        "  upload: { field: 'file', maxBytes: 1_000, mediaTypes: ['application/pdf', 'image/*', 'Text/CSV; charset=utf-8'] },",
      ),
    }),
  },
  {
    ruleId: RULE,
    name: 'an upload that states the rule of each type the kit has none for, by type and by family',
    expect: 'pass',
    files: project({
      [CONTROLLER]: controller(
        '  upload: {',
        "    field: 'file',",
        '    maxBytes: 1_000,',
        '    // application/x-unknown is named here in a comment only',
        "    mediaTypes: ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream', 'video/*', 'audio/*'],",
        "    text: 'single-byte',",
        '    contentRules: {',
        "      'application/vnd.ms-excel': 'text',",
        "      'application/octet-stream': 'unchecked',",
        "      'video/*': 'unchecked',",
        "      'audio/mpeg': 'unchecked',",
        '    },',
        '  },',
      ),
    }),
  },
  {
    ruleId: RULE,
    name: 'media types and content rules built elsewhere, which the declaration of the route judges, and a spec',
    expect: 'pass',
    files: project({
      [CONTROLLER]: controller("  upload: { field: 'file', maxBytes: 1_000, mediaTypes: STATEMENT_TYPES },"),
      [ROUTE]: route("upload: { field: 'file', maxBytes: 1_000, mediaTypes: ['video/mp4'], contentRules: RULES }"),
      [SPEC]: "export const upload = { field: 'file', maxBytes: 1, mediaTypes: ['application/octet-stream'] };\n",
    }),
  },
  ...UNREAD.map(
    ([what, upload]): Fixture => ({
      ruleId: RULE,
      name: `an upload the text does not say whole: ${what}`,
      expect: 'pass',
      files: project({ [CONTROLLER]: controller(upload) }),
    }),
  ),
  {
    ruleId: RULE,
    name: 'a controller that accepts the name a browser on Windows gives a CSV, with no rule stated',
    expect: { file: CONTROLLER },
    files: project({
      [CONTROLLER]: controller(
        "  upload: { field: 'file', maxBytes: 1_000, mediaTypes: ['text/csv', 'application/vnd.ms-excel'] },",
      ),
    }),
  },
  {
    ruleId: RULE,
    name: 'a function route that accepts bytes of any kind without saying it takes them unchecked',
    expect: { file: ROUTE },
    files: project({
      [ROUTE]: route("upload: { field: 'file', maxBytes: 1_000, mediaTypes: ['application/octet-stream'] }"),
    }),
  },
  {
    ruleId: RULE,
    name: 'a family none of whose types has a rule, and an entry that is no media type',
    expect: { file: CONTROLLER },
    files: project({
      [CONTROLLER]: controller("  upload: { field: 'file', maxBytes: 1_000, mediaTypes: ['video/*', '*/*'] },"),
    }),
  },
  {
    ruleId: RULE,
    name: 'a stated rule for a type the kit already verifies',
    expect: { file: CONTROLLER },
    files: project({
      [CONTROLLER]: controller(
        "  upload: { field: 'file', maxBytes: 1_000, mediaTypes: ['application/pdf'], contentRules: { 'application/pdf': 'unchecked' } },",
      ),
    }),
  },
  {
    ruleId: RULE,
    name: 'a stated rule for a type, and for a family, the upload does not accept',
    expect: { file: CONTROLLER },
    files: project({
      [CONTROLLER]: controller(
        "  upload: { field: 'file', maxBytes: 1_000, mediaTypes: ['text/csv', 'audio/*'], contentRules: { 'audio/mpeg': 'unchecked', 'video/mp4': 'unchecked', 'video/*': 'unchecked' } },",
      ),
    }),
  },
];
