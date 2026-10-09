/** The three purity/* rules share one mechanism: forbidden tokens and modules in domain/ and application/. */
import type { Project, Rule, SourceFile, Violation } from './types.js';
import { inContext, reporter } from './rules/helpers.js';

interface Forbidden {
  readonly pattern: RegExp;
  readonly what: string;
}

interface PurityRule {
  readonly id: string;
  readonly description: string;
  readonly code: readonly Forbidden[];
  /** Bare packages and Node built-ins (without the `node:` prefix) that give the same access. */
  readonly modules: readonly string[];
  readonly fix: string;
}

export const definePurityRule = (rule: PurityRule): Rule => ({
  id: rule.id,
  description: rule.description,
  scope: 'file',
  run: (project) => run(project, rule),
});

function run(project: Project, rule: PurityRule): Violation[] {
  const report = reporter(project, rule.id);
  return project.files.filter(isInner).flatMap((file) => {
    const layer = isDomain(file) ? 'domain' : 'application';
    const inCode = forbiddenCode(file, rule).map(({ what, line }) => report({ file: file.path, line }, `${what} is used in the ${layer} layer.`, rule.fix));
    const imported = forbiddenImports(file, rule).map(({ what, line }) => report({ file: file.path, line }, `"${what}" is imported in the ${layer} layer.`, rule.fix));
    return [...inCode, ...imported];
  });
}

interface Finding {
  readonly what: string;
  readonly line: number;
}

function forbiddenCode(file: SourceFile, rule: PurityRule): Finding[] {
  return rule.code.flatMap(({ pattern, what }) => [...file.scan.code.matchAll(pattern)].map((match) => ({ what, line: file.scan.lineAt(match.index) })));
}

function forbiddenImports(file: SourceFile, rule: PurityRule): Finding[] {
  return file.imports.flatMap(({ target, line }) => {
    if (target.kind === 'file') return [];
    const name = target.kind === 'builtin' ? (target.name.replace(/^node:/, '').split('/')[0] ?? '') : target.name;
    return rule.modules.includes(name) ? [{ what: target.name, line }] : [];
  });
}

function isDomain(file: SourceFile): boolean {
  return inContext(file.location) && file.location.layer === 'domain';
}

function isInner(file: SourceFile): boolean {
  return inContext(file.location) && !file.isTest && (file.location.layer === 'domain' || file.location.layer === 'application');
}
