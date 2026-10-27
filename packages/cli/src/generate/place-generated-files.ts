import path from 'node:path';
import { aliasRoots } from '../alias';
import { CliError } from '../cli-error';
import type { Config } from '../config';
import { contextFilePlacement } from '../context-files';
import { declaredModule, declaredModules, modulePlacement, placedImports } from '../model-modules';
import type { Workspace } from '../workspace';
import { filesUnder } from './files-under';
import { refuseEarlierLayout } from './refuse-earlier-layout';
import { sharedKernelPlacement } from './shared-kernel-placement';

/** What `generate` was asked: the context its kind writes in, the `--module` given, and the command as typed. */
export interface ModuleRequest {
  readonly context: string | undefined;
  readonly module: string | undefined;
  readonly command: string;
}

/**
 * Where the generators read and write the files of a context, named as they are without modules
 * and at their place of today: the workspace reads each where it is and writes it in the module
 * `--module` names, writes the code list and the permission set of a context at its root unless
 * the project still holds them where 0.86 and 0.87 wrote them (`contextFilePlacement`), writes a
 * file of the shared kernel at its root (`sharedKernelPlacement`), and the imports written follow. Answers what stops it, before the generated declarations are derived from the
 * tree.
 */
export function placeGeneratedFiles(ws: Workspace, config: Config, request: ModuleRequest): () => void {
  const inModules = modulesPlacement(ws, config, request);
  const contextFile = contextFilePlacement(config.contextsDir, (file) => ws.existsAsIs(file));
  const sharedKernel = sharedKernelPlacement(config, (file) => ws.existsAsIs(file));

  const place = (file: string, writing: boolean): string =>
    sharedKernel(contextFile(inModules === undefined ? file : inModules(file, writing)));

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

/** Where a file goes among the modules of the model, or nothing when no context has modules and none is asked. */
function modulesPlacement(
  ws: Workspace,
  config: Config,
  request: ModuleRequest,
): ((file: string, writing: boolean) => string) | undefined {
  const asked = askedModule(config, request);
  const hasModules = Object.values(config.contexts).some((context) => context.modules.length > 0);

  if (asked === undefined && !hasModules) {
    return undefined;
  }

  refuseEarlierLayout(ws, config, request.context);

  return modulePlacement({
    config,
    asked,
    existsAsIs: (file) => ws.existsAsIs(file),
    modulesOf: (context) => declaredModules(config, context),
    unplaced: (context, relative) => {
      throw unplacedError(context, relative, { modules: declaredModules(config, context), command: request.command });
    },
    subjectModule: (context, spec) => subjectModule(ws, config, { context, spec }),
    split: (context, relative, holder) => {
      throw new CliError(
        `The use case of ${relative} is in the module "${holder}" of "${context}": --module ${asked?.module ?? ''} would split it between two modules.`,
        `Run it without --module, which places the file with its use case, or with \`--module ${holder}\`.`,
      );
    },
  });
}

/** What a spec is named after, in a context: the module that holds the production file of that name. */
interface Named {
  readonly context: string;
  readonly spec: string;
}

/**
 * The module holding the file a spec is named after (`appointment.repository.contract.spec.ts`
 * is of `appointment.repository.ts`), the longest name winning; undefined when no module holds one.
 */
function subjectModule(ws: Workspace, config: Config, { context, spec }: Named): string | undefined {
  const stem = spec.replace(/\.spec\.ts$/, '');

  const matches = declaredModules(config, context).flatMap((module) =>
    filesUnder(ws, `${config.contextsDir}/${context}/${module}`)
      .map((file) => path.posix.basename(file).replace(/\.ts$/, ''))
      .filter((name) => stem === name || stem.startsWith(`${name}.`))
      .map((name) => ({ module, length: name.length })),
  );

  return matches.sort((left, right) => right.length - left.length)[0]?.module;
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
