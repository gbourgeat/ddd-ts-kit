import { CONFIG_FILE } from '../../config/index.js';
import { declaredRoleOf } from '../../declared/index.js';
import type { ContextLocation } from '../model/context-location.js';
import type { Finding } from '../model/finding.js';
import type { Flaw } from '../model/flaw.js';
import type { ImportTarget } from '../model/import-target.js';
import type { Project } from '../model/project.js';
import type { ResolvedImport } from '../model/resolved-import.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inContext } from '../support/in-context.js';
import { isDeclaredStyle } from '../support/is-declared-style.js';
import { isPortFile } from '../support/is-port-file.js';
import { lineOfSequence } from '../support/line-of-sequence.js';
import { pathInContext } from '../support/path-in-context.js';
import { perFile } from '../support/per-file.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';
import { braceDepthAt } from '../text/brace-depth-at.js';
import { WITHOUT_MODULE } from '../../model-modules/index.js';

const SCHEMA_CALL = /(?<![\w$])(?:schemaNameOf|contextSchema|pgSchema|withSchema)\s*\(\s*$/;

const SHARED_STATE =
  /(?<![\w$.])export\s+(?:let\s+([\w$]+)|const\s+([\w$]+)\s*(?::[^=;]+)?=\s*new\s+(?:Map|Set|WeakMap)\s*[<(])/g;

const GATEWAY_FIX =
  'Declare what this context needs as a gateway port in application/ports and call the other context from its adapter in infrastructure/external, through the published language: in process today, a remote client tomorrow.';

const STATE_FIX =
  'Hold the state in an object created in the composition root (the module file) and passed by constructor, or behind a port, so that the context still works once it runs in its own process.';

export const contextExtractable: Rule = {
  id: 'context/extractable',
  description:
    'A context can run alone: its module and its declared classes wire nothing of another context, it reads no table of another context, shares no repository nor port with one and exports no mutable state.',
  scope: 'file',
  run(project) {
    const contexts = Object.keys(project.config.contexts);

    return perFile(project, this.id, (file) => {
      const here = inContext(file.location) && !file.isTest ? file.location : undefined;

      if (here === undefined) {
        return [];
      }

      const declares =
        isDeclaredStyle(project) && declaredRoleOf(pathInContext(project, file) ?? '', WITHOUT_MODULE) !== undefined;

      const ties = file.imports.flatMap((module) => foreignTie(module, here, declares));

      return [...ties, ...foreignSchemas(file, here, contexts), ...sharedState(file)];
    });
  },
  acrossProject(project) {
    const deployable = Object.entries(project.config.contexts).flatMap(([name, context]) =>
      context.deployable ? [name] : [],
    );

    return toViolations(
      reporter(project, this.id),
      CONFIG_FILE,
      deployable.flatMap((name) => withoutEntryPoint(project, name)),
    );
  },
};

/** An import that ties the composition, the storage, a use case or a declared class of this context to the inside of another one. */
function foreignTie({ target, line }: ResolvedImport, here: ContextLocation, declares: boolean): Finding[] {
  const there = insideAnotherContext(target, here);

  if (there === undefined) {
    return [];
  }

  const wiring = declares && there.isPort ? portTie(here, there.location) : undefined;

  const tie =
    moduleTie(here, there.location) ?? storageTie(here, there.location) ?? useCaseTie(here, there.location) ?? wiring;

  return tie === undefined ? [] : [{ line, ...tie }];
}

/** Where an import leads when it reaches another context outside its published language. */
function insideAnotherContext(
  target: ImportTarget,
  here: ContextLocation,
): { location: ContextLocation; isPort: boolean } | undefined {
  if (target.kind !== 'file' || !inContext(target.location)) {
    return undefined;
  }

  const { location } = target;

  return location.context === here.context || location.layer === 'published-language'
    ? undefined
    : { location, isPort: isPortFile(target.path, location) };
}

function moduleTie(here: ContextLocation, there: ContextLocation): Flaw | undefined {
  if (here.layer !== 'module') {
    return undefined;
  }

  return {
    message: `The module of "${here.context}" imports ${there.context}/${there.layer === 'module' ? 'module file' : there.layer}: the context cannot be composed alone.`,
    fix: `Wire ${here.context} with the kernel and the platform only; what it needs from ${there.context} comes through a port of its own, bound here to an adapter of infrastructure/external.`,
  };
}

function storageTie(here: ContextLocation, there: ContextLocation): Flaw | undefined {
  if (here.layer !== 'infrastructure' || here.inside[0] !== 'persistence' || there.layer !== 'infrastructure') {
    return undefined;
  }

  return {
    message: `The persistence of "${here.context}" imports the infrastructure of "${there.context}": two contexts would share tables or a transaction.`,
    fix: `Keep one schema per context: read the data of ${there.context} from a projection fed by its integration events, or through a gateway port.`,
  };
}

function useCaseTie(here: ContextLocation, there: ContextLocation): Flaw | undefined {
  const isHandler = here.inside.at(-1)?.endsWith('.handler.ts') === true;

  if (!isHandler || there.layer !== 'domain' || there.inside[0] !== 'repositories') {
    return undefined;
  }

  return {
    message: `A handler of "${here.context}" imports a repository of "${there.context}": one use case would span two contexts.`,
    fix: GATEWAY_FIX,
  };
}

/** A declared class names what it depends on by port: a port of another context ties the wiring of the two. */
function portTie(here: ContextLocation, there: ContextLocation): Flaw {
  return {
    message: `A declared class of "${here.context}" imports a port of "${there.context}": the context could no longer be wired alone.`,
    fix: `Depend on a port of ${here.context} (an abstract class of its application/ports or domain/repositories), of the kernel, of @ddd-ts-kit/auth or of the platform; what ${here.context} needs from ${there.context} is a gateway port of its own, whose adapter in infrastructure/external calls ${there.context} through its published language.`,
  };
}

function foreignSchemas(file: SourceFile, here: ContextLocation, contexts: readonly string[]): Finding[] {
  if (here.layer !== 'infrastructure' || here.inside[0] !== 'persistence') {
    return [];
  }

  const others = contexts.filter((context) => context !== here.context);

  return file.scan.strings.flatMap((literal) => {
    const owner = others.find((context) => literal.value === context || literal.value === context.replaceAll('-', '_'));

    if (
      owner === undefined ||
      !SCHEMA_CALL.test(file.scan.code.slice(Math.max(0, literal.start - 40), literal.start))
    ) {
      return [];
    }

    const fix = `Use the schema of ${here.context} only; what ${here.context} needs from ${owner} is a projection fed by integration events or a call through a gateway port.`;

    return [
      {
        line: literal.line,
        message: `The persistence of "${here.context}" names the database schema of "${owner}".`,
        fix,
      },
    ];
  });
}

function sharedState(file: SourceFile): Finding[] {
  const { code } = file.scan;

  return [...code.matchAll(SHARED_STATE)]
    .filter((match) => braceDepthAt(code, match.index) === 0)
    .map((match) => ({
      line: file.scan.lineAt(match.index),
      message: `${match[1] ?? match[2] ?? 'A binding'} is mutable state exported by the module: every importer shares it, in one process only.`,
      fix: STATE_FIX,
    }));
}

function withoutEntryPoint(project: Project, context: string): Finding[] {
  const entryPoint = `${project.config.sourceRoot}/apps/${context}/main.ts`;

  if (project.files.some((file) => file.path === entryPoint)) {
    return [];
  }

  const composed = isDeclaredStyle(project) ? `the declarations of ${context}` : `${context}.module.ts`;

  return [
    {
      line: lineOfSequence(project.configText, ['"contexts"', `"${context}":`, '"deployable"']),
      message: `The context "${context}" is declared deployable but ${entryPoint} does not exist.`,
      fix: `Create ${entryPoint}, composing ${composed} with the kernel and the platform only, or set contexts.${context}.deployable to false.`,
    },
  ];
}
