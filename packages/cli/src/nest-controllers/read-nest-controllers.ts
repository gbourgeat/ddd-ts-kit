import { specifierOf } from '../alias';
import { aliasRoots } from '../alias/alias-roots';
import { scan } from '../check/scan/scan';
import type { ImportRecord } from '../check/scan/import-record';
import type { ClassShape } from '../check/structure/class-shape';
import type { MethodShape } from '../check/structure/method-shape';
import { readStructure } from '../check/structure/read-structure';
import type { Config } from '../config';
import type { NestAnswer } from './nest-answer';
import type { NestControllerEntry, NestRouteMethod } from './nest-controller-entry';
import type { NestReadType } from './nest-read-type';
import type { NestRequestPart } from './nest-request-part';
import { parametersOf } from './parameters-of';

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
const DECLARED_REQUEST = /@KitRoute\s*\(\s*\{[\s\S]*\brequest\s*:\s*\{([^}]*)\}/;

/** A parameter that takes a part of the request whole: `@Body() body: IssueInvoiceBody`. */
const WHOLE_PART =
  /^@(Body|Query|Param|Headers)\s*\(\s*\)\s*(?:(?:public|private|protected|readonly)\s+)*[\w$]+\??\s*:\s*([\s\S]+)$/;

const SOURCES: Readonly<Record<string, NestRequestPart['source']>> = {
  Body: 'body',
  Query: 'query',
  Param: 'params',
  Headers: 'headers',
};

/**
 * The Nest controllers of a context that the kit serves (a class of `presentation/` carrying
 * Nest's `@Controller`, in a file that imports the bridge), in the order of their files, with what
 * the signature of each route method says: the DTO class of each part of the request a parameter
 * takes whole (`@Body() body: IssueInvoiceBody`), and its answer, `Promise<IssuedInvoice>` a DTO
 * class, `Promise<Accepted>` an identifier, `Promise<void>` nothing.
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

/** The methods of the class that carry a route decorator of Nest, each with what its signature takes and answers. */
function routeMethodsOf(shape: ClassShape, reading: Reading): NestRouteMethod[] {
  let previous = shape.bodyStart;

  return shape.methods.flatMap((method) => {
    const decorators = reading.code.slice(previous, method.start);

    previous = method.end;

    if (method.isConstructor || !ROUTE_DECORATOR.test(decorators)) {
      return [];
    }

    const signature = reading.text.slice(method.start, method.bodyStart);
    const written = RETURN_TYPE.exec(signature)?.[1];

    return [
      {
        name: method.name,
        line: method.line,
        request: requestOf(method, decorators, reading),
        answer: written === undefined ? { kind: 'unread', text: 'no return type' } : answerOf(written, reading),
        declaresResponse: DECLARED_RESPONSE.test(decorators),
      },
    ];
  });
}

/** The parts of the request the parameters take whole, each with its type and whether `@KitRoute` gives it. */
function requestOf({ start, bodyStart }: MethodShape, decorators: string, reading: Reading): NestRequestPart[] {
  const declared = DECLARED_REQUEST.exec(decorators)?.[1] ?? '';

  return parametersOf(reading.text.slice(start, bodyStart), reading.code.slice(start, bodyStart)).flatMap(
    (parameter) => {
      const [, decorator = '', type = ''] = WHOLE_PART.exec(parameter) ?? [];
      const source = SOURCES[decorator];

      return source === undefined
        ? []
        : [{ source, type: typeOf(type.trim(), reading), declared: givesPart(declared, source) }];
    },
  );
}

/** Whether the members of `request` of `@KitRoute` name that part, written in full (`query: schema`) or short (`query`). */
function givesPart(members: string, source: NestRequestPart['source']): boolean {
  return new RegExp(`(?:^|,)\\s*${source}\\s*(?::|,|$)`).test(members.trim());
}

function answerOf(written: string, reading: Reading): NestAnswer {
  const type = (PROMISED.exec(written)?.[1] ?? written).trim();

  if (type === 'void' || type === 'undefined') {
    return { kind: 'none' };
  }

  if (type === 'Accepted' && importOf(type, reading)?.specifier === '@ddd-ts-kit/http') {
    return { kind: 'accepted' };
  }

  const read = typeOf(type, reading);

  return read.kind === 'class' ? read : { kind: 'unread', text: written };
}

/** A DTO class imported by its name from a file of the project, else a type the kit cannot read. */
function typeOf(type: string, reading: Reading): NestReadType {
  const imported = importOf(type, reading);

  return imported !== undefined && isClassAt(reading, imported.specifier, type)
    ? { kind: 'class', name: type, specifier: imported.specifier }
    : { kind: 'unread', text: type };
}

function importOf(type: string, { imports }: Reading): ImportRecord | undefined {
  return TYPE_NAME.test(type) ? imports.find(({ names }) => names.includes(type)) : undefined;
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
