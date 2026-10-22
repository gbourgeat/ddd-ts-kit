import { matchingBracket } from '../check/text/matching-bracket';
import { splitTopLevel } from '../check/text/split-top-level';
import { toName } from '../naming';
import { entriesOf } from './entries-of';
import type { FunctionRoute } from './function-route';

const FACTORY = /export function (\w+)Route\((\w+): (\w+)\): Route \{\s*return defineRoute\(/;
const IMPORT = /^import[\s\S]*?from '[^']+';\n/gm;
const HANDLER = /^async \((\w+)\) => \{([\s\S]*)\}$/;

/** Reads a route file, or says in one sentence what keeps it from being turned into a controller. */
export function readFunctionRoute(file: string, source: string): FunctionRoute | string {
  const factory = FACTORY.exec(source);

  if (factory === null) {
    return 'it is not written as `export function <name>Route(<bus>): Route { return defineRoute(..); }`';
  }

  const open = factory.index + factory[0].length - 1;
  const close = matchingBracket(source, open);
  const [spec, handler] = splitTopLevel(source.slice(open + 1, close)).map((part) => part.code);
  const written = HANDLER.exec((handler ?? '').replace(/,\s*$/, '').trim());

  if (spec === undefined || written === null) {
    return 'its handler is not written as `async (input) => { .. }`';
  }

  const head = source.slice(0, factory.index);
  const kebab = file.slice(file.lastIndexOf('/') + 1).replace(/\.route\.ts$/, '');

  return {
    file,
    kebab,
    pascal: toName(kebab).pascal,
    bus: factory[2] ?? '',
    busType: factory[3] ?? '',
    imports: head.match(IMPORT) ?? [],
    prelude: head.replace(IMPORT, '').trim(),
    spec: entriesOf(spec),
    input: written[1] ?? 'input',
    body: written[2] ?? '',
    trailer: source.slice(source.indexOf('\n}\n', close) + 3).trim(),
  };
}
