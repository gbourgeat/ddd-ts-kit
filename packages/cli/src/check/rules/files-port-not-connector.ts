import type { Finding } from '../model/finding';
import type { ResolvedImport } from '../model/resolved-import';
import type { Rule } from '../model/rule';
import { inLayer } from '../support/in-layer';
import { perFile } from '../support/per-file';

/** The connectors of the kernel: a model or a use case that names one has chosen where files live. */
const CONNECTORS = ['InMemoryFileStorage', 'LocalFileStorage', 'SelfSignedFileStorage'];

export const filesPortNotConnector: Rule = {
  id: 'files/port-not-connector',
  description:
    'domain/ and application/ name the `FileStorage` port of the kernel, never one of its connectors (`InMemoryFileStorage`, `LocalFileStorage`): where files live is chosen by the platform.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const here = inLayer(file, 'domain') ?? inLayer(file, 'application');

      return here === undefined ? [] : file.imports.flatMap((imported) => connectorsOf(imported, here.layer));
    });
  },
};

function connectorsOf({ target, names, line }: ResolvedImport, layer: string): Finding[] {
  if (target.kind !== 'package' || target.name !== '@ddd-ts-kit/kernel') {
    return [];
  }

  return names
    .filter((name) => CONNECTORS.includes(name))
    .map((name) => ({
      line,
      message: `${layer}/ imports the file storage connector ${name}: it chooses where files live, which is the decision of the platform.`,
      fix: 'Depend on `FileStorage`, or on `FileStaging` and `FileKeys`, of @ddd-ts-kit/kernel; the platform binds the connector (`init --storage`), the in-memory one in the tests.',
    }));
}
