import { CONFIG_FILE } from '../../config.js';
import { declaredRoleOf } from '../../declared/roles.js';
import { braceDepthAt } from '../text-shapes.js';
import type { Project, Rule, SourceFile } from '../types.js';
import { inContext, isDeclaredStyle, lineOfSequence, pathInContext, reporter, toViolations, type ContextLocation, type Finding } from './helpers.js';

const SCHEMA_CALL = /(?<![\w$])(?:schemaNameOf|contextSchema|pgSchema|withSchema)\s*\(\s*$/;
const SHARED_STATE = /(?<![\w$.])export\s+(?:let\s+([\w$]+)|const\s+([\w$]+)\s*(?::[^=;]+)?=\s*new\s+(?:Map|Set|WeakMap)\s*[<(])/g;
const GATEWAY_FIX =
  'Declare what this context needs as a gateway port in application/ports and call the other context from its adapter in infrastructure/external, through the published language: in process today, a remote client tomorrow.';

const TOKEN_NAME = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const PORTS_FILE = /\.ports\.ts$/;

type ImportedModule = SourceFile['imports'][number];

export const contextExtractable: Rule = {
  id: 'context/extractable',
  description: 'A context can run alone: its module and its declared classes wire nothing of another context, it reads no table of another context, shares no repository with one and exports no mutable state.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const contexts = Object.keys(project.config.contexts);
    return project.files.flatMap((file) => {
      const here = inContext(file.location) && !file.isTest ? file.location : undefined;
      if (here === undefined) return [];
      const declares = isDeclaredStyle(project) && declaredRoleOf(pathInContext(project, file) ?? '') !== undefined;
      const tokens = declares ? file.imports.flatMap((module) => foreignTokens(module, here)) : [];
      const findings = [...file.imports.flatMap((module) => foreignWiring(module, here)), ...tokens, ...foreignSchemas(file, here, contexts), ...sharedState(file)];
      return toViolations(report, file.path, findings);
    });
  },
  acrossProject(project) {
    const deployable = Object.entries(project.config.contexts).flatMap(([name, context]) => (context.deployable ? [name] : []));
    return toViolations(reporter(project, this.id), CONFIG_FILE, deployable.flatMap((name) => withoutEntryPoint(project, name)));
  },
};

/** An import that ties the composition, the storage or a use case of this context to the inside of another one. */
function foreignWiring({ target, line }: ImportedModule, here: ContextLocation): Finding[] {
  if (target.kind !== 'file' || !inContext(target.location) || target.location.context === here.context) return [];
  const there = target.location;
  if (there.layer === 'published-language') return [];
  const tie = moduleTie(here, there) ?? storageTie(here, there) ?? useCaseTie(here, there);
  return tie === undefined ? [] : [{ line, ...tie }];
}

type Tie = Omit<Finding, 'line'>;

function moduleTie(here: ContextLocation, there: ContextLocation): Tie | undefined {
  if (here.layer !== 'module') return undefined;
  return {
    message: `The module of "${here.context}" imports ${there.context}/${there.layer === 'module' ? 'module file' : there.layer}: the context cannot be composed alone.`,
    fix: `Wire ${here.context} with the kernel and the platform only; what it needs from ${there.context} comes through a port of its own, bound here to an adapter of infrastructure/external.`,
  };
}

function storageTie(here: ContextLocation, there: ContextLocation): Tie | undefined {
  if (here.layer !== 'infrastructure' || here.inside[0] !== 'persistence' || there.layer !== 'infrastructure') return undefined;
  return {
    message: `The persistence of "${here.context}" imports the infrastructure of "${there.context}": two contexts would share tables or a transaction.`,
    fix: `Keep one schema per context: read the data of ${there.context} from a projection fed by its integration events, or through a gateway port.`,
  };
}

function useCaseTie(here: ContextLocation, there: ContextLocation): Tie | undefined {
  const isHandler = here.inside.at(-1)?.endsWith('.handler.ts') === true;
  if (!isHandler || there.layer !== 'domain' || there.inside[0] !== 'repositories') return undefined;
  return { message: `A handler of "${here.context}" imports a repository of "${there.context}": one use case would span two contexts.`, fix: GATEWAY_FIX };
}

/** A declared class names what it depends on by token: a token of another context ties the wiring of the two. */
function foreignTokens({ target, names, line }: ImportedModule, here: ContextLocation): Finding[] {
  if (target.kind !== 'file' || !inContext(target.location) || target.location.context === here.context) return [];
  const owner = target.location.context;
  const token = PORTS_FILE.test(target.path) ? (names[0] ?? 'a token') : names.find((name) => name.length > 1 && TOKEN_NAME.test(name));
  if (token === undefined) return [];
  return [
    {
      line,
      message: `A declared class of "${here.context}" names ${token}, a token of "${owner}": the context could no longer be wired alone.`,
      fix: `Depend on a token of ${here.context} (application/ports/${here.context}.ports.ts), of the kernel, of @ddd-ts-kit/auth or of the platform; what ${here.context} needs from ${owner} is a gateway port of its own, whose adapter in infrastructure/external calls ${owner} through its published language.`,
    },
  ];
}

function foreignSchemas(file: SourceFile, here: ContextLocation, contexts: readonly string[]): Finding[] {
  if (here.layer !== 'infrastructure' || here.inside[0] !== 'persistence') return [];
  const others = contexts.filter((context) => context !== here.context);
  return file.scan.strings.flatMap((literal) => {
    const owner = others.find((context) => literal.value === context || literal.value === context.replaceAll('-', '_'));
    if (owner === undefined || !SCHEMA_CALL.test(file.scan.code.slice(Math.max(0, literal.start - 40), literal.start))) return [];
    const fix = `Use the schema of ${here.context} only; what ${here.context} needs from ${owner} is a projection fed by integration events or a call through a gateway port.`;
    return [{ line: literal.line, message: `The persistence of "${here.context}" names the database schema of "${owner}".`, fix }];
  });
}

function sharedState(file: SourceFile): Finding[] {
  const { code } = file.scan;
  return [...code.matchAll(SHARED_STATE)]
    .filter((match) => braceDepthAt(code, match.index) === 0)
    .map((match) => ({
      line: file.scan.lineAt(match.index),
      message: `${match[1] ?? match[2] ?? 'A binding'} is mutable state exported by the module: every importer shares it, in one process only.`,
      fix: 'Hold the state in an object created in the composition root (the module file) and passed by constructor, or behind a port, so that the context still works once it runs in its own process.',
    }));
}

function withoutEntryPoint(project: Project, context: string): Finding[] {
  const entryPoint = `${project.config.sourceRoot}/apps/${context}/main.ts`;
  if (project.files.some((file) => file.path === entryPoint)) return [];
  return [
    {
      line: lineOfSequence(project.configText, ['"contexts"', `"${context}":`, '"deployable"']),
      message: `The context "${context}" is declared deployable but ${entryPoint} does not exist.`,
      fix: `Create ${entryPoint}, composing ${isDeclaredStyle(project) ? `the declarations of ${context}` : `${context}.module.ts`} with the kernel and the platform only, or set contexts.${context}.deployable to false.`,
    },
  ];
}
