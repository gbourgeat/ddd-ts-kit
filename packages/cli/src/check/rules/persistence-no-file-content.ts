import { fileContentFindings } from '../files/file-content-findings';
import { schemaSources } from '../files/schema-sources';
import type { Rule } from '../model/rule';
import { reporter } from '../support/reporter';
import { toViolations } from '../support/to-violations';

export const persistenceNoFileContent: Rule = {
  id: 'persistence/no-file-content',
  description:
    'No column of file content in a persistence schema or a migration: no binary type (`bytea`, `blob`, `varbinary`, `.binary()`, Prisma `Bytes`) and no base64 column. Files live in the `FileStorage` port; a row keeps the `StoredFile` reference.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);

    return schemaSources(project).flatMap(({ file, text }) => toViolations(report, file, fileContentFindings(text)));
  },
};
