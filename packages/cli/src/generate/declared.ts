import type { Config } from '../config.js';
import { barrelFile, portsFile, renderBarrel, routesFile } from '../declared/roles.js';
import { insertInRegion, parseWiring } from '../markers.js';
import type { RenderContext } from '../render.js';
import { renderTemplate, templateExists } from '../templates.js';
import type { Workspace } from '../workspace.js';
import type { Scope } from './scope.js';

export const isDeclared = (config: Config): boolean => config.stack.style === 'declared';

/**
 * In the declared style a class registers itself, so a new element leaves little to write
 * outside its own file: its token in the ports file of the context, its route in the routes
 * file, and in the platform module the value or the factory no decorator can express. Each
 * kind says it in `<kind>/<target>.declared.tpl`.
 */
export function declareWiring(scope: Scope, kind: string, context: RenderContext): void {
  const base = kind.includes('/') ? `${kind}.` : `${kind}/`;
  for (const [target, file] of Object.entries(wiringTargets(scope))) {
    const template = `${base}${target}.declared.tpl`;
    if (templateExists(template)) extend(scope.ws, { file, wiring: renderTemplate(template, context), seed: SEEDS[target] });
  }
}

function wiringTargets(scope: Scope): Record<string, string> {
  const { config, context, dir } = scope;
  return {
    ports: `${dir}/${portsFile(context.kebab)}`,
    routes: `${dir}/${routesFile(context.kebab)}`,
    platform: `${config.platformDir}/platform.module.ts`,
    composition: `${config.platformDir}/application.ts`,
  };
}

/** A ports file is born with its first token: an empty one would be a file nothing imports. */
const SEEDS: Readonly<Record<string, string>> = {
  ports: '// ddd-ts-kit:imports\n// /ddd-ts-kit:imports\n\n// ddd-ts-kit:tokens\n// /ddd-ts-kit:tokens\n',
};

interface Extension {
  readonly file: string;
  readonly wiring: string;
  /** What the file starts from when it does not exist yet; without it a missing file is said in a note. */
  readonly seed: string | undefined;
}

function extend(ws: Workspace, { file, wiring, seed }: Extension): void {
  const original = ws.read(file) ?? seed;
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
  if (ws.exists(file)) ws.update(file, content);
  else ws.create(file, content);
}

/**
 * Rewrites the barrel of every declared context from its tree. Called at the end of every
 * `generate` and by `docs`: the barrel is derived, like the documentation, and
 * `declarations/barrel-current` reports one that was left behind.
 */
export function refreshBarrels(ws: Workspace, config: Config): void {
  if (!isDeclared(config) || config.stack.assembly !== 'barrel') return;
  for (const context of ws.directories(config.contextsDir)) {
    if (config.contexts[context] === undefined) continue;
    const directory = `${config.contextsDir}/${context}`;
    const file = `${directory}/${barrelFile(context)}`;
    const content = renderBarrel(filesUnder(ws, directory, ''));
    if (ws.exists(file)) ws.update(file, content);
    else ws.create(file, content);
  }
}

/** Every file below `directory`, on disk or planned, relative to it. */
export function filesUnder(ws: Workspace, directory: string, inside: string): string[] {
  const here = inside === '' ? directory : `${directory}/${inside}`;
  const prefix = inside === '' ? '' : `${inside}/`;
  const files = ws.list(here).map((name) => `${prefix}${name}`);
  return [...files, ...ws.directories(here).flatMap((child) => filesUnder(ws, directory, `${prefix}${child}`))];
}
