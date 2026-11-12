import { uploadContentDefects } from '../files/upload-content-defects';
import { uploadDeclarations } from '../files/upload-declarations';
import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { perFile } from '../support/per-file';

const FIX =
  "Give each accepted media type a content rule. The kit has one for the formats it recognises by their first bytes (PDF, PNG, JPEG, GIF, WebP, zip and the office documents, gzip) and for text (`text/plain`, `text/csv`, `text/tab-separated-values`, `text/markdown`, `application/json`, `application/csv`). For another type the route states it in `contentRules` of the upload: `'text'` when the content is text under another name (`{ 'application/vnd.ms-excel': 'text' }` for the CSV a browser on Windows sends), `'unchecked'` when the route takes the bytes as they are (`{ 'application/octet-stream': 'unchecked' }`). A stated rule names a type the upload accepts and the kit has no rule for.";

export const filesUploadContentRule: Rule = {
  id: 'files/upload-content-rule',
  description:
    'Every media type the `upload` of a route or a controller accepts has a content rule, of the kit (a signature, text) or stated in its `contentRules`: a type with none could receive no file, and `@ddd-ts-kit/http` refuses the route when it is declared.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => (isRouteFile(file) ? findingsOf(file) : []));
  },
};

function isRouteFile(file: SourceFile): boolean {
  return !file.isTest && /\.(?:route|controller)\.ts$/.test(file.path);
}

function findingsOf({ scan }: SourceFile): Finding[] {
  return uploadDeclarations(scan)
    .flatMap(uploadContentDefects)
    .map(({ literal, message }) => ({
      line: literal.line,
      message: `${message} The upload could receive no file of it, and the route is refused when it is declared.`,
      fix: FIX,
    }));
}
