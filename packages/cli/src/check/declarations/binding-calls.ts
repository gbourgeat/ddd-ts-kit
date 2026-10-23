import type { SourceFile } from '../model/source-file';
import { importsPackage } from '../support/imports-package';
import { callArguments } from '../text/call-arguments';
import { matchingBracket } from '../text/matching-bracket';
import type { BindingCall } from './binding-call';

const DI_PACKAGE = '@ddd-ts-kit/di';
const CALL = /(?:([\w$]+(?:\s*\.\s*[\w$]+)*)\s*\.\s*|\.\s*|(?<![\w$.]))(bind|rebind|resolve|fake|override)\s*\(/g;
/** Receivers whose `resolve` has nothing to do with a container. */
const OTHER_RESOLVERS = ['Promise', 'path', 'require', 'import.meta'];

/**
 * The binding calls of a source, as plain calls or member calls. They are read only in a file
 * that imports something from `@ddd-ts-kit/di`, so that `Promise.resolve('x')` or
 * `path.resolve('x')` elsewhere is never taken for one.
 */
export function bindingCalls(file: SourceFile): BindingCall[] {
  if (!importsPackage(file, DI_PACKAGE)) {
    return [];
  }

  const { code } = file.scan;

  return [...code.matchAll(CALL)].flatMap((match) => {
    const receiver = (match[1] ?? '').replace(/\s+/g, '');
    const open = match.index + match[0].length - 1;

    if (
      match[2] === 'resolve' &&
      OTHER_RESOLVERS.some((other) => receiver === other || receiver.endsWith(`.${other}`))
    ) {
      return [];
    }

    return [
      {
        method: match[2] ?? '',
        line: file.scan.lineAt(open),
        open,
        close: matchingBracket(code, open),
        token: callArguments(code, open)[0],
      },
    ];
  });
}
