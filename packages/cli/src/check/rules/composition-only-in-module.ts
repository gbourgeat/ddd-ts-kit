import type { Rule, SourceFile } from '../types.js';
import { reporter } from './helpers.js';

export const compositionOnlyInModule: Rule = {
  id: 'composition/only-in-module',
  description: 'Adapters are instantiated or registered only in <context>.module.ts, main.ts and platform/.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.filter(isOutsideComposition).flatMap((file) =>
      importedAdapters(file).flatMap(({ name, context }) => {
        const use = new RegExp(`(?:(?<![\\w$.])new\\s+|\\buseClass\\s*:\\s*)${name.replace(/\$/g, '\\$')}(?![\\w$])`).exec(file.scan.code);
        if (use === null) return [];
        return [
          report(
            { file: file.path, line: file.scan.lineAt(use.index) },
            `The adapter ${name} is instantiated outside the composition root.`,
            `Receive the port through the constructor and bind ${name} to it in ${context}.module.ts (or src/main.ts).`,
          ),
        ];
      }),
    );
  },
};

function isOutsideComposition({ isTest, location }: SourceFile): boolean {
  if (isTest || location.area === 'main' || location.area === 'platform') return false;
  return !(location.area === 'context' && location.layer === 'module');
}

function importedAdapters(file: SourceFile): { name: string; context: string }[] {
  return file.imports.flatMap(({ target, names }) => {
    if (target.kind !== 'file' || target.location.area !== 'context' || target.location.layer !== 'infrastructure') return [];
    const { context } = target.location;
    return isInfrastructureOf(file, context) ? [] : names.map((name) => ({ name, context }));
  });
}

/** An adapter may assemble its own helpers (a mapper, a client wrapper) of the same context. */
function isInfrastructureOf({ location }: SourceFile, context: string): boolean {
  return location.area === 'context' && location.layer === 'infrastructure' && location.context === context;
}
