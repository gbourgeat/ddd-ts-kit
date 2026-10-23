import { describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers';
import { initProject } from './support/init-project';

const BILLING = 'src/contexts/billing';

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

    expect(read(root, `${BILLING}/application/commands/commands.declarations.ts`)).toContain(
      'injected(AttachInvoiceScanHandler, [FileStaging]);',
    );

    expect(exists(root, `${BILLING}/test/unit/attach-invoice-scan.handler.spec.ts`)).toBe(true);
    expect(exists(root, `${BILLING}/test/unit/attach-invoice-scan.controller.spec.ts`)).toBe(true);
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
