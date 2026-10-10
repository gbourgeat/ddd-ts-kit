import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { bindingPlace } from '../support/binding-place.js';
import { perFile } from '../support/per-file.js';

const DI_PACKAGE = '@ddd-ts-kit/di';
/** The functions of the container package that turn declared classes into a module. */
const ASSEMBLERS = ['contextModule', 'discoverContext'];
const INCLUDE = /\.\s*include\s*\(/g;

const ASSEMBLY_FIX =
  'Assemble declared classes in the composition root only (src/main.ts, src/apps/<context>/main.ts, the platform directory or <context>.module.ts): everywhere else a class receives what it needs through its constructor.';

export const compositionOnlyInModule: Rule = {
  id: 'composition/only-in-module',
  description:
    'Adapters are instantiated or bound, and declared classes assembled, only in <context>.module.ts, main.ts and platform/.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => [
      ...(isOutsideComposition(file) ? usedAdapters(file, project) : []),
      ...(isOutsideAssembly(file, project) ? assemblies(file) : []),
    ]);
  },
};

function isOutsideComposition({ isTest, location }: SourceFile): boolean {
  if (isTest || location.area === 'main' || location.area === 'platform') {
    return false;
  }

  return !(location.area === 'context' && location.layer === 'module');
}

/** `new X` and `.toClass(X, ..)` of a class imported from infrastructure/. */
function usedAdapters(file: SourceFile, project: Project): Finding[] {
  return importedAdapters(file).flatMap(({ name, context }) => {
    const escaped = name.replace(/\$/g, '\\$');

    const use = new RegExp(`(?:(?<![\\w$.])new\\s+|\\.\\s*toClass\\s*\\(\\s*)${escaped}(?![\\w$])`).exec(
      file.scan.code,
    );

    if (use === null) {
      return [];
    }

    const how = use[0].startsWith('new') ? 'instantiated' : 'bound';
    const fix = `Receive the port through the constructor and bind ${name} to it in ${bindingPlace(project, context)} (or src/main.ts).`;

    return [
      {
        line: file.scan.lineAt(use.index),
        message: `The adapter ${name} is ${how} outside the composition root.`,
        fix,
      },
    ];
  });
}

function importedAdapters(file: SourceFile): { name: string; context: string }[] {
  return file.imports.flatMap(({ target, names }) => {
    if (target.kind !== 'file' || target.location.area !== 'context' || target.location.layer !== 'infrastructure') {
      return [];
    }

    const { context } = target.location;

    return isInfrastructureOf(file, context) ? [] : names.map((name) => ({ name, context }));
  });
}

/** An adapter may assemble its own helpers (a mapper, a client wrapper) of the same context. */
function isInfrastructureOf({ location }: SourceFile, context: string): boolean {
  return location.area === 'context' && location.layer === 'infrastructure' && location.context === context;
}

/** Declared classes are also assembled by the entry point of a context run alone, `apps/<context>/main.ts`. */
function isOutsideAssembly(file: SourceFile, project: Project): boolean {
  const entryPoint = new RegExp(`^${project.config.sourceRoot}/apps/[^/]+/main\\.ts$`);

  return isOutsideComposition(file) && !entryPoint.test(file.path);
}

/** `contextModule(...)`, `discoverContext(...)` and `.include(...)` on a module builder, in a file that imports the container package. */
function assemblies(file: SourceFile): Finding[] {
  const fromContainer = file.imports.filter(({ target }) => target.kind === 'package' && target.name === DI_PACKAGE);

  if (fromContainer.length === 0) {
    return [];
  }

  const { code } = file.scan;
  const assemblers = fromContainer.flatMap(({ names }) => names.filter((name) => ASSEMBLERS.includes(name)));

  const calls = assemblers.flatMap((name) => {
    const call = new RegExp(`(?<![\\w$.])${name}\\s*\\(`).exec(code);

    return call === null
      ? []
      : [
          {
            line: file.scan.lineAt(call.index),
            message: `${name}(...) assembles a context outside the composition root.`,
            fix: ASSEMBLY_FIX,
          },
        ];
  });

  const included = [...code.matchAll(INCLUDE)].map((match) => ({
    line: file.scan.lineAt(match.index),
    message: 'include(...) registers declared classes outside the composition root.',
    fix: ASSEMBLY_FIX,
  }));

  return [...calls, ...included];
}
