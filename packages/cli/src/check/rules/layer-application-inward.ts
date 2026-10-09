import type { Layer, Location, Rule, SourceFile } from '../types.js';
import { describeTarget, inLayer, reporter, type Finding } from './helpers.js';

type ImportedModule = SourceFile['imports'][number];

const INWARD: readonly Layer[] = ['domain', 'application', 'published-language'];

export const layerApplicationInward: Rule = {
  id: 'layer/application-inward',
  description:
    'application/ imports domain/, application/, published languages and the allowed kernel packages: never infrastructure/, presentation/, a framework or a driver.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const allowed = project.config.applicationAllowedPackages;
    return project.files.flatMap((file) => {
      const here = inLayer(file, 'application');
      if (here === undefined) return [];
      return file.imports.flatMap((imported) => outward(imported, here.context, allowed)).map(({ line, message, fix }) => report({ file: file.path, line }, message, fix));
    });
  },
};

function outward({ target, line, specifier }: ImportedModule, context: string, allowed: readonly string[]): Finding[] {
  if (target.kind === 'package') {
    if (allowed.includes(target.name)) return [];
    const fix = `Declare a port in application/ports named after the need, implement it with "${target.name}" in infrastructure/, and bind it in ${context}.module.ts.`;
    return [{ line, message: `The application layer imports the package "${target.name}".`, fix }];
  }
  if (target.kind === 'builtin') {
    return [{ line, message: `The application layer imports the Node built-in "${specifier}".`, fix: 'Hide the I/O behind a port in application/ports and implement it in infrastructure/external.' }];
  }
  if (isInward(target.location, context)) return [];
  const fix = 'Depend on a port (application/ports) or a repository interface (domain/repositories) instead, and let the module file bind the adapter.';
  return [{ line, message: `The application layer imports ${describeTarget(target)}.`, fix }];
}

function isInward(there: Location, context: string): boolean {
  if (there.area === 'shared-kernel') return true;
  // Another context: the context/* rules decide.
  if (there.area === 'context' && there.context !== context) return true;
  return there.area === 'context' && INWARD.includes(there.layer);
}
