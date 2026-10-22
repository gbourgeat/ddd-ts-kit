import { aliasRoots } from '../alias';
import { CliError } from '../cli-error';
import type { Config } from '../config';
import { declaredModule, declaredModules, modulePlacement, placedImports } from '../model-modules';
import type { Workspace } from '../workspace';

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

  const modulesOf = (context: string): string[] => declaredModules(config, context);

  const place = modulePlacement({
    config,
    asked,
    existsAsIs: (file) => ws.existsAsIs(file),
    modulesOf,
    unplaced: (context, relative) => {
      throw unplacedError(context, relative, { modules: declaredModules(config, context), command: request.command });
    },
    split: (context, relative, holder) => {
      throw new CliError(
        `The use case of ${relative} is in the module "${holder}" of "${context}": --module ${asked?.module ?? ''} would split it between two modules.`,
        `Run it without --module, which places the file with its use case, or with \`--module ${holder}\`.`,
      );
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
  if (module === undefined) {
    return undefined;
  }

  if (context === undefined) {
    throw new CliError(
      '--module applies to a kind that writes in a context.',
      'Give the module to the kinds that write the model or its use cases: `ddd-ts-kit generate <kind> <context> ... --module <module>`.',
    );
  }

  // An unknown context is refused by the kind, with the contexts the project has.
  if (config.contexts[context] === undefined) {
    return undefined;
  }

  return { context, module: declaredModule(config, context, module) };
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
