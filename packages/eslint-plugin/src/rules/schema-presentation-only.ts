import type { LintedFile } from '../project/linted-file';
import { importListener } from '../support/imports/import-listener';
import { defineRule } from '../support/rule/define-rule';

/** The packages a schema of the HTTP contract is written with: whoever imports one declares a schema. */
const VALIDATION_PACKAGES: readonly string[] = [
  '@ddd-ts-kit/validation',
  '@sinclair/typebox',
  'arktype',
  'class-transformer',
  'class-validator',
  'class-validator-jsonschema',
  'typebox',
  'valibot',
  'zod',
];

/** The layers of a context that never read a type of the contract: its presentation layer does, its module and specs wire and drive it. */
const READERS_OUTSIDE = ['domain', 'application', 'infrastructure', 'published-language'];

export const schemaPresentationOnly = defineRule<'declaredInSharedKernel' | 'readOutsidePresentation'>({
  id: 'schema/presentation-only',
  type: 'problem',
  recommended: 'error',
  description:
    'Under "stack.schemas": "shared", a schema of the HTTP contract lives in presentation/: of its context, or of the shared kernel when several contexts answer with it. The shared kernel declares no schema anywhere else, and no domain, application, infrastructure or published language imports one of its presentation/.',
  messages: {
    declaredInSharedKernel:
      'The shared kernel declares a schema outside presentation/ (it imports "{{specifier}}"): every layer of every context may import the shared kernel, a schema there reaches the domain. Move the file under presentation/ of the shared kernel (`ddd-ts-kit generate schema shared-kernel <Name>`), and keep the value object it describes as plain TypeScript.',
    readOutsidePresentation:
      'This file imports "{{specifier}}", a schema of the HTTP contract: a schema is a presentation type, the model and the use cases never read one. Import it from presentation/ only, and map it there to the command, the query or the value object the inner layer expects.',
  },
  create({ file, report }) {
    if (file.config.stack.schemas !== 'shared' || file.isTest || holdsSchemas(file)) {
      return {};
    }

    const declares = file.location.area === 'shared-kernel';
    const reads = declares || (file.location.area === 'context' && READERS_OUTSIDE.includes(file.location.layer));

    return importListener(file, ({ node, specifier, target }) => {
      if (declares && target.kind === 'package' && VALIDATION_PACKAGES.includes(target.name)) {
        report({ node, messageId: 'declaredInSharedKernel', data: { specifier } });
      }

      if (reads && target.kind === 'file' && target.path.startsWith(sharedPresentation(file))) {
        report({ node, messageId: 'readOutsidePresentation', data: { specifier } });
      }
    });
  },
});

function holdsSchemas(file: LintedFile): boolean {
  return file.location.area === 'context'
    ? file.location.layer === 'presentation'
    : file.path.startsWith(sharedPresentation(file));
}

function sharedPresentation(file: LintedFile): string {
  return `${file.config.sharedKernelDir}/presentation/`;
}
