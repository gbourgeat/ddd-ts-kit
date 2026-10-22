import { aliasRoots } from '../alias/index.js';
import { CliError } from '../cli-error.js';
import type { Config } from '../config/index.js';
import { declaredModules, modulePlacement, modulesOnDisk, placedImports } from '../model-modules/index.js';
import type { Workspace } from '../workspace/index.js';

/** What `generate` was asked: the context its kind writes in, the `--module` given, and the command as typed. */
export interface ModuleRequest {
  readonly context: string | undefined;
  readonly module: string | undefined;
  readonly command: string;
}

/**
 * In a project whose contexts have modules of their model, the generators keep naming files as
 * they are without modules: the workspace reads each where it is and writes it in the module
 * `--module` names, and the imports written follow. Answers what stops it, before the generated
 * declarations are derived from the tree.
 */
export function placeInModules(ws: Workspace, config: Config, request: ModuleRequest): () => void {
  const asked = askedModule(config, request);
  const hasModules = Object.values(config.contexts).some((context) => context.modules.length > 0);

  if (asked === undefined && !hasModules) {
    return () => undefined;
  }

  const modulesOf = (context: string): string[] => [
    ...new Set([...declaredModules(config, context), ...modulesOnDisk(ws, `${config.contextsDir}/${context}`)]),
  ];

  const place = modulePlacement({
    config,
    asked,
    existsAsIs: (file) => ws.existsAsIs(file),
    modulesOf,
    unplaced: (context, relative) => {
      throw unplacedError(context, relative, { modules: declaredModules(config, context), command: request.command });
    },
  });

  let active = true;

  ws.placeFiles(place);

  ws.rewriteImports((_file, text) =>
    active ? placedImports(text, aliasRoots(config), (target) => place(target, false)) : text,
  );

  return () => {
    active = false;
    ws.placeFiles(undefined);
  };
}

function askedModule(
  config: Config,
  { context, module }: ModuleRequest,
): { context: string; module: string } | undefined {
  if (module === undefined || context === undefined) {
    return undefined;
  }

  const declared = declaredModules(config, context);

  if (!declared.includes(module)) {
    throw new CliError(
      `The context "${context}" declares no module "${module}".`,
      `Declare it first with \`ddd-ts-kit generate module ${context} ${module} --purpose "<which concepts it holds>"\`${declared.length > 0 ? `, or use one of: ${declared.join(', ')}` : ''}.`,
    );
  }

  return { context, module };
}

interface Unplaced {
  readonly modules: readonly string[];
  readonly command: string;
}

function unplacedError(context: string, relative: string, { modules, command }: Unplaced): CliError {
  return new CliError(
    `The context "${context}" is divided into the modules of its model (${modules.join(', ')}), and this command writes ${relative} without saying in which one.`,
    `Run it again with the module whose concepts it serves: \`ddd-ts-kit ${command} --module <${modules.join('|')}>\`. A concept that fits no module may be one to name: \`ddd-ts-kit generate module ${context} <module>\`.`,
  );
}
