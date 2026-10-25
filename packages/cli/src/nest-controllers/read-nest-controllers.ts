import { specifierOf } from '../alias';
import { aliasRoots } from '../alias/alias-roots';
import { scan } from '../check/scan/scan';
import type { ImportRecord } from '../check/scan/import-record';
import type { ClassShape } from '../check/structure/class-shape';
import { readStructure } from '../check/structure/read-structure';
import type { Config } from '../config';
import type { NestAnswer } from './nest-answer';
import type { NestControllerEntry, NestRouteMethod } from './nest-controller-entry';

/** What the reader needs of the project: the text of a file, and the files below a directory. */
export interface ProjectFiles {
  read(file: string): string | undefined;
  under(directory: string): readonly string[];
}

const NEST = '@nestjs/common';
const BRIDGE = '@ddd-ts-kit/http/nest';
const ROUTE_DECORATOR = /@(?:Get|Post|Put|Patch|Delete|Head|Options)\s*\(/;
const RETURN_TYPE = /\)\s*:\s*([\s\S]+?)\s*$/;
const PROMISED = /^Promise\s*<([\s\S]+)>$/;
const TYPE_NAME = /^[A-Z][\w$]*$/;
const CONTROLLER = /@Controller\s*\(/;
const DECLARED_RESPONSE = /@KitRoute\s*\(\s*\{[\s\S]*\bresponse\s*:/;

/**
 * The Nest controllers of a context that the kit serves (a class of `presentation/` carrying
 * Nest's `@Controller`, in a file that imports the bridge), in the order of their files, with what
 * each route method answers as its signature says: `Promise<IssuedInvoice>` a DTO class,
 * `Promise<Accepted>` an identifier, `Promise<void>` nothing.
 */
export function readNestControllers(files: ProjectFiles, config: Config, context: string): NestControllerEntry[] {
  const presentation = `${config.contextsDir}/${context}/presentation`;

  return files
    .under(presentation)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .sort()
    .flatMap((file) => controllersIn(files, config, file));
}

function controllersIn(files: ProjectFiles, config: Config, file: string): NestControllerEntry[] {
  const text = files.read(file) ?? '';
  const scanned = scan(text);
  const { imports } = scanned;

  if (!imports.some(({ specifier }) => specifier === NEST) || !imports.some(({ specifier }) => specifier === BRIDGE)) {
    return [];
  }

  const reading: Reading = { files, config, imports, text, code: scanned.code };

  return readStructure(scanned)
    .classes.filter(
      ({ isExported, start }) => isExported && CONTROLLER.test(scanned.code.slice(Math.max(0, start - 400), start)),
    )
    .map((shape) => ({
      file,
      className: shape.name,
      specifier: specifierOf(config, file),
      methods: routeMethodsOf(shape, reading),
    }));
}

interface Reading {
  readonly files: ProjectFiles;
  readonly config: Config;
  readonly imports: readonly ImportRecord[];
  readonly text: string;
  /** The text with its comments and strings blanked, where decorators are looked for. */
  readonly code: string;
}

/** The methods of the class that carry a route decorator of Nest, each with what its signature answers. */
function routeMethodsOf(shape: ClassShape, reading: Reading): NestRouteMethod[] {
  let previous = shape.bodyStart;

  return shape.methods.flatMap((method) => {
    const decorators = reading.code.slice(previous, method.start);

    previous = method.end;

    if (method.isConstructor || !ROUTE_DECORATOR.test(decorators)) {
      return [];
    }

    const written = RETURN_TYPE.exec(reading.text.slice(method.start, method.bodyStart))?.[1];

    return [
      {
        name: method.name,
        line: method.line,
        answer: written === undefined ? { kind: 'unread', text: 'no return type' } : answerOf(written, reading),
        declaresResponse: DECLARED_RESPONSE.test(decorators),
      },
    ];
  });
}

function answerOf(written: string, reading: Reading): NestAnswer {
  const type = (PROMISED.exec(written)?.[1] ?? written).trim();

  if (type === 'void' || type === 'undefined') {
    return { kind: 'none' };
  }

  const imported = TYPE_NAME.test(type) ? reading.imports.find(({ names }) => names.includes(type)) : undefined;

  if (imported === undefined) {
    return { kind: 'unread', text: written };
  }

  if (type === 'Accepted' && imported.specifier === '@ddd-ts-kit/http') {
    return { kind: 'accepted' };
  }

  return isClassAt(reading, imported.specifier, type)
    ? { kind: 'class', name: type, specifier: imported.specifier }
    : { kind: 'unread', text: written };
}

/** Whether the file an alias names exports a class of that name: an interface or a type has no schema to read. */
function isClassAt({ files, config }: Reading, specifier: string, name: string): boolean {
  const root = aliasRoots(config).find(({ prefix }) => specifier.startsWith(prefix));

  if (root === undefined) {
    return false;
  }

  const file = `${root.directory}/${specifier.slice(root.prefix.length).replace(/\.js$/, '')}.ts`;

  return new RegExp(`export\\s+(?:abstract\\s+)?class\\s+${name}\\b`).test(files.read(file) ?? '');
}
