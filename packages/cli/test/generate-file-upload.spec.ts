import { describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';
const UNIT = `${BILLING}/test/unit`;
const CONTROLLER = `${BILLING}/presentation/http/invoices/attach-invoice-scan/attach-invoice-scan.controller.ts`;

const TERMS = [
  '--term',
  'Attach=to join a document to what it proves',
  '--term',
  'Scan=the image of a paper invoice',
  '--term',
  'Invoice=what a customer owes',
];

const UPLOAD = ['AttachInvoiceScan', '--path', '/invoices/:invoiceId/scan', ...TERMS];

function upload(root: string, ...access: readonly string[]) {
  return cli(root, 'generate', 'file-upload', 'billing', ...UPLOAD, ...access);
}

describe('generate file-upload', () => {
  it('writes the command that carries the file, the handler that promotes it, the controller that declares it, and their specs', () => {
    const root = initProject('--context', 'billing:core');

    expect(upload(root, '--permission', 'invoice.attach-scan').code).toBe(0);

    const handler = read(root, `${BILLING}/application/commands/attach-invoice-scan/attach-invoice-scan.handler.ts`);

    const controller = read(
      root,
      `${BILLING}/presentation/http/invoices/attach-invoice-scan/attach-invoice-scan.controller.ts`,
    );

    expect(read(root, `${BILLING}/application/commands/attach-invoice-scan/attach-invoice-scan.command.ts`)).toContain(
      "this.upload = new FileUpload(file, 'attach-invoice-scan');",
    );

    expect(handler).toContain('const { file } = command.upload;');
    expect(handler).toContain('await this.staging.promoteOnCommit(file.key);');
    expect(controller).toContain("upload: { field: 'file', maxBytes: 10_485_760,");
    expect(controller).toContain('new AttachInvoiceScanCommand(request.actor, request.upload)');

    expect(read(root, `${BILLING}/application/application.declarations.ts`)).toContain(
      'injected(AttachInvoiceScanHandler, [FileStaging]);',
    );

    expect(exists(root, `${BILLING}/test/unit/attach-invoice-scan.handler.spec.ts`)).toBe(true);
    const spec = read(root, `${BILLING}/test/unit/attach-invoice-scan.controller.spec.ts`);

    // The one arrangement of a controller spec: a recording bus, and routeOf given the upload reader once.
    expect(spec).toContain(
      "const commands = new RecordingCommandBus().answering(AttachInvoiceScanCommand, () => 'file-1');",
    );

    expect(spec).toContain('routeOf(new AttachInvoiceScanController(commands), { uploads });');
    expect(spec).toContain("upload: { area: 'attach-invoice-scan', received: { fileName: 'scan.pdf' } }");
    expect(spec).not.toContain('executeRoute');
  });

  it('registers the handler on the files of the platform, in a project wired by hand', () => {
    const root = initProject('--http', 'fastify', '--di', 'manual', '--context', 'billing:core');

    expect(upload(root, '--public').code).toBe(0);

    expect(read(root, `${BILLING}/billing.module.ts`)).toContain(
      'new AttachInvoiceScanHandler(platform.files.staging)',
    );

    expect(read(root, `${BILLING}/application/commands/attach-invoice-scan/attach-invoice-scan.command.ts`)).toContain(
      'extends Command<string>',
    );
  });

  it('names the ports of files in the module file of an explicit context', () => {
    const root = initProject('--style', 'explicit', '--context', 'billing:core');

    expect(upload(root, '--permission', 'invoice.attach-scan').code).toBe(0);

    expect(read(root, `${BILLING}/billing.module.ts`)).toContain(
      '.handledBy(AttachInvoiceScanHandler, [FileStaging]);',
    );
  });

  it('is refused where no file storage or no HTTP stack is wired', () => {
    const withoutStorage = upload(initProject('--storage', 'none', '--context', 'billing:core'), '--public');
    const withoutHttp = upload(initProject('--http', 'none', '--context', 'billing:core'), '--public');

    expect([withoutStorage.code, withoutStorage.stderr]).toEqual([
      2,
      expect.stringContaining('stack.storage is "none"'),
    ]);

    expect([withoutHttp.code, withoutHttp.stderr]).toEqual([2, expect.stringContaining('stack.http is "none"')]);
  });
});

describe('generate file-upload --text', () => {
  it('declares a document unless told the file is text: no text rule, and specs on a PDF', () => {
    const root = initProject('--context', 'billing:core');

    expect(upload(root, '--public').code).toBe(0);

    const spec = read(root, `${UNIT}/attach-invoice-scan.controller.spec.ts`);

    expect(read(root, CONTROLLER)).toContain("mediaTypes: ['application/pdf', 'image/png', 'image/jpeg'] },");
    expect(read(root, CONTROLLER)).not.toContain('contentRules');
    expect(spec).not.toContain('multipartUploads');
    expect(read(root, `${UNIT}/attach-invoice-scan.handler.spec.ts`)).toContain("fileName: 'scan.pdf'");
  });

  it('declares with --text single-byte a text file under the names browsers give a CSV, and covers one that is not UTF-8', () => {
    const root = initProject('--context', 'billing:core');

    expect(upload(root, '--public', '--text', 'single-byte').code).toBe(0);

    const controller = read(root, CONTROLLER);
    const spec = read(root, `${UNIT}/attach-invoice-scan.controller.spec.ts`);

    expect(controller).toContain("mediaTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel'],");
    expect(controller).toContain("text: 'single-byte',");
    expect(controller).toContain("contentRules: { 'application/vnd.ms-excel': 'text' },");
    expect(spec).toContain("const WINDOWS_1252 = Buffer.from('label;amount\\r\\ncaf\\xe9;3,50\\r\\n', 'latin1');");
    expect(spec).toContain("it('receives byte for byte a text file that is not UTF-8, and refuses a workbook");
    expect(spec).toContain('routeOf(new AttachInvoiceScanController(commands), { uploads: multipartUploads() });');
    expect(spec).toContain('const taken = await send({ ...sent, ...aForm(WINDOWS_1252) });');
    expect(spec).toContain('expect(received).toEqual(WINDOWS_1252);');
    expect(spec).not.toContain('UTF_8');
    expect(read(root, `${UNIT}/attach-invoice-scan.handler.spec.ts`)).toContain("fileName: 'export.csv'");
  });

  it('declares with --text utf-8 a text file read as UTF-8, whose spec refuses another encoding', () => {
    const root = initProject('--context', 'billing:core');

    expect(upload(root, '--public', '--text', 'utf-8').code).toBe(0);

    const spec = read(root, `${UNIT}/attach-invoice-scan.controller.spec.ts`);

    expect(read(root, CONTROLLER)).toContain("text: 'utf-8',");
    expect(spec).toContain('const taken = await send({ ...sent, ...aForm(UTF_8) });');
    expect(spec).toContain('const inAnotherEncoding = await send({ ...sent, ...aForm(WINDOWS_1252) });');
  });

  it('writes the same declaration and the same spec on a Nest controller', () => {
    const root = initProject('--http', 'nest', '--context', 'billing:core');

    expect(upload(root, '--public', '--text', 'single-byte').code).toBe(0);

    expect(read(root, CONTROLLER)).toContain("    contentRules: { 'application/vnd.ms-excel': 'text' },");

    expect(read(root, `${UNIT}/attach-invoice-scan.controller.spec.ts`)).toContain(
      'const { send } = routeOf(served, { uploads: multipartUploads() });',
    );
  });

  it('refuses a text rule it does not know, saying the two it takes', () => {
    const refused = upload(initProject('--context', 'billing:core'), '--public', '--text', 'latin1');

    expect([refused.code, refused.stderr]).toEqual([
      2,
      expect.stringContaining('--text takes utf-8 or single-byte, not "latin1".'),
    ]);
  });
});

describe('init --storage', () => {
  it('keeps files in a directory by default, signed links served by the application, uploads read as they stream', () => {
    const root = initProject('--context', 'billing:core');

    expect(read(root, 'src/platform/files/open-files.ts')).toContain('new LocalFileStorage(');

    expect(read(root, 'src/platform/http/start-http-server.ts')).toContain(
      'mountExpress(app, served.fileRoutes, served.boundary);',
    );

    expect(read(root, 'src/platform/auth/authentication/http-boundary.ts')).toContain('uploads: multipartUploads(),');
    expect(read(root, 'src/platform/buses/create-command-bus.ts')).toContain('.use(stagingUploads(resolve))');
    expect(read(root, '.gitignore')).toContain('.data/');
    expect(read(root, 'package.json')).toContain('"busboy"');
  });

  it('keeps files in a bucket of MinIO in the compose stack with s3, and nothing with none', () => {
    const s3 = initProject('--storage', 's3', '--context', 'billing:core');
    const none = initProject('--storage', 'none', '--context', 'billing:core');

    expect(read(s3, 'src/platform/files/open-files.ts')).toContain('new S3FileStorage(');
    expect(read(s3, 'docker-compose.yml')).toContain('image: pgsty/minio:');
    expect(read(s3, '.env.example')).toContain('S3_BUCKET=');
    expect(read(s3, 'package.json')).toContain('"@ddd-ts-kit/s3"');
    expect(exists(none, 'src/platform/files')).toBe(false);
    expect(read(none, 'package.json')).not.toContain('"busboy"');
    expect(read(none, 'src/platform/buses/create-command-bus.ts')).not.toContain('stagingUploads');
  });
});
