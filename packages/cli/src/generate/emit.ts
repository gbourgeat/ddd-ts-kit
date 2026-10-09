import type { Config } from '../config.js';
import { CliError } from '../errors.js';
import { insertInRegion, parseWiring } from '../markers.js';
import type { RenderContext } from '../render.js';
import { renderTemplate } from '../templates.js';
import type { Workspace } from '../workspace.js';
import type { Scope } from './scope.js';

/** One generated file: the template it comes from and its path inside the context. */
export type Output = readonly [template: string, target: string];

/** Renders templates to paths relative to the context directory. */
export function emit(scope: Scope, context: RenderContext, outputs: readonly Output[]): void {
  for (const [template, target] of outputs) {
    scope.ws.create(`${scope.dir}/${target}`, renderTemplate(template, context));
  }
}

/** Registers a new element in the module file of the context. */
export function wire(scope: Scope, kind: string, context: RenderContext): void {
  const file = `${scope.dir}/${scope.context.kebab}.module.ts`;
  applyWiring(scope.ws, file, renderTemplate(`${kind}/wiring.${wiringFamily(scope.config)}.tpl`, context));
}

/** The nest module wires by hand inside a Nest provider, so it shares the manual family. */
function wiringFamily(config: Config): 'tsyringe' | 'manual' {
  return config.stack.di === 'tsyringe' ? 'tsyringe' : 'manual';
}

/** Applies a rendered wiring template to a file with marker regions. */
export function applyWiring(ws: Workspace, file: string, wiring: string): void {
  const original = ws.read(file);
  if (original === undefined) {
    ws.note(`${file} does not exist: wire the new element by hand.`);
    return;
  }
  let content = original;
  for (const [region, block] of parseWiring(wiring)) {
    if (block.trim() === '') continue;
    const next = insertInRegion(content, region, block);
    if (next === undefined) ws.note(`${file} has no "ddd-ts-kit:${region}" region: add this by hand:\n${block.trimEnd()}`);
    else content = next;
  }
  ws.update(file, content);
}

export interface Prerequisite {
  /** Path inside the context. */
  readonly file: string;
  readonly what: string;
  readonly createdBy: string;
}

export function requireFile(scope: Scope, prerequisite: Prerequisite): void {
  const target = `${scope.dir}/${prerequisite.file}`;
  if (scope.ws.exists(target)) return;
  throw new CliError(`${prerequisite.what} does not exist in "${scope.context.kebab}" (${target}).`, `Create it first with \`${prerequisite.createdBy}\`.`);
}
