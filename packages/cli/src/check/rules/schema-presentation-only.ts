import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { holdsSchemas } from '../schemas/holds-schemas';
import { sharedPresentation } from '../schemas/shared-presentation';
import { sharesSchemas } from '../schemas/shares-schemas';
import { VALIDATION_PACKAGES } from '../schemas/validation-packages';
import { perFile } from '../support/per-file';

/** Where a context reads a type of the contract: its presentation layer; the module file and the specs wire and drive it. */
const READERS_OUTSIDE = ['domain', 'application', 'infrastructure', 'published-language'];

export const schemaPresentationOnly: Rule = {
  id: 'schema/presentation-only',
  description:
    'Under "stack.schemas": "shared", a schema of the HTTP contract lives in presentation/: of its context, or of the shared kernel when several contexts answer with it. The shared kernel declares no schema anywhere else, and no domain, application, infrastructure or published language imports one of its presentation/.',
  scope: 'file',
  run(project) {
    if (!sharesSchemas(project)) {
      return [];
    }

    return perFile(project, this.id, (file) =>
      file.isTest || holdsSchemas(project, file)
        ? []
        : [...declaredInSharedKernel(file), ...readOutsidePresentation(project, file)],
    );
  },
};

function declaredInSharedKernel(file: SourceFile): Finding[] {
  if (file.location.area !== 'shared-kernel') {
    return [];
  }

  return file.imports
    .filter(({ target }) => target.kind === 'package' && VALIDATION_PACKAGES.includes(target.name))
    .map(({ line, specifier }) => ({
      line,
      message: `The shared kernel declares a schema outside presentation/ (it imports "${specifier}"): every layer of every context may import the shared kernel, a schema there reaches the domain.`,
      fix: 'Move the file under presentation/ of the shared kernel (`ddd-ts-kit generate schema shared-kernel <Name>` writes one there), or keep the value object it describes in the shared kernel as plain TypeScript and its schema in presentation/.',
    }));
}

function readOutsidePresentation(project: Project, file: SourceFile): Finding[] {
  const { location } = file;

  const reader =
    location.area === 'shared-kernel' || (location.area === 'context' && READERS_OUTSIDE.includes(location.layer));

  if (!reader) {
    return [];
  }

  const directory = sharedPresentation(project.config);

  return file.imports
    .filter(({ target }) => target.kind === 'file' && target.path.startsWith(directory))
    .map(({ line, specifier }) => ({
      line,
      message: `${describe(file)} imports "${specifier}", a schema of the HTTP contract: a schema is a presentation type, the model and the use cases never read one.`,
      fix: 'Import it from presentation/ only, and map it there to the command, the query or the value object the inner layer expects.',
    }));
}

function describe({ location }: SourceFile): string {
  return location.area === 'context'
    ? `${location.layer}/ of ${location.context}`
    : 'The shared kernel outside presentation/';
}
