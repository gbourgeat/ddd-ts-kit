import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { inLayers } from '../support/in-layers';
import { perFile } from '../support/per-file';
import type { PurityRule } from './purity-rule';

/** The three purity/* rules share one mechanism: forbidden tokens and modules in domain/ and application/. */
export function definePurityRule(rule: PurityRule): Rule {
  return {
    id: rule.id,
    description: rule.description,
    scope: 'file',
    run: (project) =>
      perFile(project, rule.id, (file) => {
        const layer = inLayers(file, ['domain', 'application'])?.layer;

        return layer === undefined ? [] : [...forbiddenCode(file, rule, layer), ...forbiddenImports(file, rule, layer)];
      }),
  };
}

function forbiddenCode(file: SourceFile, rule: PurityRule, layer: string): Finding[] {
  return rule.code.flatMap(({ pattern, what }) =>
    [...file.scan.code.matchAll(pattern)].map((match) => ({
      line: file.scan.lineAt(match.index),
      message: `${what} is used in the ${layer} layer.`,
      fix: rule.fix,
    })),
  );
}

function forbiddenImports(file: SourceFile, rule: PurityRule, layer: string): Finding[] {
  return file.imports.flatMap(({ target, line }) => {
    if (target.kind === 'file') {
      return [];
    }

    const name = target.kind === 'builtin' ? (target.name.replace(/^node:/, '').split('/')[0] ?? '') : target.name;

    return rule.modules.includes(name)
      ? [{ line, message: `"${target.name}" is imported in the ${layer} layer.`, fix: rule.fix }]
      : [];
  });
}
