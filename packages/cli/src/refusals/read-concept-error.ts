import { wholeLiteral } from '../check/declarations/whole-literal.js';
import { scan, type Scan } from '../check/scan/scan.js';
import { callArguments } from '../check/text/call-arguments.js';
import { classBody } from '../generate/errors/class-body.js';
import { staticMethods, type StaticMethod } from '../generate/errors/static-methods.js';
import type { ConceptErrorClass, ConceptFactory } from './concept-error-class.js';
import { firstParameter } from './first-parameter.js';
import { memberStart } from './member-start.js';

const CLASS = /export\s+class\s+([A-Za-z_$][\w$]*)\s+extends\s+ConceptError\b/;
const REFUSAL_CALL = /(?<![\w$])([A-Za-z_$][\w$]*)\s*\.\s*refusal\s*\(/g;
const IMPORT = /^import [^;]+;\n/gm;

interface Origin {
  readonly file: string;
  readonly context: string;
}

interface Read {
  readonly source: string;
  readonly scanned: Scan;
  readonly className: string;
}

/** Reads an error class per concept: each of its static factories, with the code it sets. Undefined when the file holds none. */
export function readConceptError(source: string, origin: Origin): ConceptErrorClass | undefined {
  const scanned = scan(source);
  const declared = CLASS.exec(scanned.code);
  const className = declared?.[1] ?? '';
  const body = classBody(scanned, className);

  if (declared === null || body === undefined) {
    return undefined;
  }

  return {
    ...origin,
    className,
    factories: staticMethods(scanned.code, body).map((method) => factoryOf({ source, scanned, className }, method)),
    imports: source.match(IMPORT) ?? [],
  };
}

function factoryOf(read: Read, method: StaticMethod): ConceptFactory {
  const declared = read.scanned.code.lastIndexOf('static', method.open);
  const start = memberStart(read.source, declared);
  const text = read.source.slice(start, method.end + 1);
  const parameter = firstParameter(read.scanned.code, read.scanned.code.indexOf('(', declared));

  return { name: method.name, parameter, start, end: method.end, text, ...codeOf(read, method) };
}

/** A factory moves alone when it builds one refusal of its class, whose code is one string literal. */
function codeOf({ scanned, className }: Read, method: StaticMethod): Pick<ConceptFactory, 'code' | 'manual'> {
  const calls = [...scanned.code.slice(method.open, method.end).matchAll(REFUSAL_CALL)];
  const [call] = calls;

  if (call === undefined || calls.length > 1) {
    return { code: undefined, manual: 'it does not build exactly one refusal with refusal(..)' };
  }

  if (call[1] !== className && call[1] !== 'this') {
    return { code: undefined, manual: `it builds the refusal of ${call[1] ?? ''}, not of its own class` };
  }

  const [first, message] = callArguments(scanned.code, method.open + call.index + call[0].length - 1);
  const code = first === undefined ? undefined : wholeLiteral(scanned, first);

  if (code === undefined || message === undefined) {
    return { code: undefined, manual: 'its code is not one string literal followed by a message' };
  }

  return { code };
}
