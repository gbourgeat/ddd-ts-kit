import { outsideConcern } from '../outside-concerns.js';
import type { ImportTarget, Rule, SourceFile } from '../types.js';
import { describeTarget, inLayer, reporter, type Finding } from './helpers.js';

type ImportedModule = SourceFile['imports'][number];
type ImportedFile = Extract<ImportTarget, { kind: 'file' }>;

export const layerDomainPurity: Rule = {
  id: 'layer/domain-purity',
  description:
    'domain/ imports only its own domain/, the shared kernel and the allowed kernel packages: no framework, ORM, validation library or Node built-in.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const allowed = project.config.domainAllowedPackages;
    return project.files.flatMap((file) => {
      const here = inLayer(file, 'domain');
      if (here === undefined) return [];
      return file.imports.flatMap((imported) => impure(imported, here.context, allowed)).map(({ line, message, fix }) => report({ file: file.path, line }, message, fix));
    });
  },
};

function impure({ target, line, specifier }: ImportedModule, context: string, allowed: readonly string[]): Finding[] {
  if (target.kind === 'package') {
    const concern = outsideConcern('The domain', target.name, specifier);
    if (concern !== undefined) return [{ line, ...concern }];
    if (allowed.includes(target.name)) return [];
    const fix = `Remove the import: express the need as plain TypeScript or as a port in application/ports, and keep decorators and schemas of "${target.name}" in infrastructure or presentation.`;
    return [{ line, message: `The domain imports the package "${target.name}".`, fix }];
  }
  if (target.kind === 'builtin') {
    const fix = 'Receive the value (an id, a date, a hash) as a parameter, produced by a port such as IdGenerator or Clock in the application layer.';
    return [{ line, message: `The domain imports the Node built-in "${specifier}".`, fix }];
  }
  return outsideTheDomain(target, context).map((finding) => ({ line, ...finding }));
}

function outsideTheDomain(target: ImportedFile, context: string): Omit<Finding, 'line'>[] {
  const there = target.location;
  if (there.area === 'shared-kernel') return [];
  if (there.area === 'context' && there.context !== context) {
    // Reaching into another context's internals is reported once, by context/published-language-only.
    if (there.layer !== 'published-language') return [];
    const fix = 'Translate the upstream contract in application/integration/consumers or infrastructure/anti-corruption and hand the domain its own types.';
    return [{ message: `The domain of "${context}" imports the published language of "${there.context}".`, fix }];
  }
  if (there.area === 'context' && there.layer === 'domain') return [];
  const fix = 'Invert the dependency: declare what the domain needs as an interface in domain/ (or a port in application/ports) and let the outer layer implement it.';
  return [{ message: `The domain imports ${describeTarget(target)}.`, fix }];
}
