import { specifierOf } from '../alias';
import type { Scope } from '../generate/scope';
import { withImport } from '../generate/with-import';
import { withAuthorizerImport } from './with-authorizer-import';

const WRAPPED = 'SignedInGrantsAuthorizer';
const AUTHORIZER = /(export function createAuthorizer\(\): Authorizer \{\n) {2}return ([\s\S]*?);\n\}/;

/** The authorizer of the platform, wrapped once; false when the file is not one the generator wrote. */
export function wrapAuthorizer(scope: Scope, file: string, grants: string): boolean {
  const source = scope.ws.read(file);

  if (source === undefined) {
    return false;
  }

  if (source.includes(WRAPPED)) {
    return true;
  }

  if (!AUTHORIZER.test(source)) {
    return false;
  }

  const wrapped = source.replace(
    AUTHORIZER,
    `$1  const model = $2;\n\n  return new ${WRAPPED}({ grants: signedInGrants, otherwise: model });\n}`,
  );

  scope.ws.update(file, withImport(withAuthorizerImport(wrapped, WRAPPED), signedInImport(scope, grants)));

  return true;
}

function signedInImport(scope: Scope, grants: string): string {
  return `import { signedInGrants } from '${specifierOf(scope.config, grants)}';`;
}
