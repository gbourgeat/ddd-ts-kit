import { specifierOf } from '../alias';
import { insertInRegion } from '../markers';
import type { Scope } from '../generate/scope';
import { withImport } from '../generate/with-import';
import { renderTemplate } from '../templating';
import { withAuthorizerImport } from './with-authorizer-import';
import { platformPath } from '../generate/platform-path';

const REGION = 'signed-in-grants';
const WRAPPED = 'SignedInGrantsAuthorizer';
const AUTHORIZER = /(export function createAuthorizer\(\): Authorizer \{\n) {2}return ([\s\S]*?);\n\}/;

/**
 * Grants every signed-in person the permissions of the context, whatever the access model: the
 * line `'<context>:*'` in `signed-in-grants.ts` of the platform, which `createAuthorizer` asks
 * before the model once wrapped in `SignedInGrantsAuthorizer`. An authorizer the generator cannot
 * read is left to the team, with a step saying how.
 */
export function grantToSignedIn(scope: Scope): void {
  const grants = platformPath(scope, 'auth/authorization/signed-in-grants.ts');
  const line = `'${scope.context.kebab}:*',`;
  const current = scope.ws.read(grants) ?? renderTemplate('presets/signed-in-grants.ts.tpl', {});
  const next = insertInRegion(current, REGION, line) ?? current;

  writeFile(scope, grants, next);

  scope.ws.step({
    file: grants,
    anchor: line,
    text: grantStep(
      scope,
      wrapAuthorizer(scope, platformPath(scope, 'auth/authorization/create-authorizer.ts'), grants),
    ),
  });
}

function grantStep(scope: Scope, isWrapped: boolean): string {
  const granted = `every signed-in person now holds the permissions of ${scope.context.kebab}, its policies deciding inside an organisation.`;

  return isWrapped
    ? `check this grant: ${granted}`
    : `wrap the authorizer of create-authorizer.ts in new SignedInGrantsAuthorizer({ grants: signedInGrants, otherwise }): until then ${scope.context.kebab} refuses who holds no grant of the access model.`;
}

/** The authorizer of the platform, wrapped once; false when the file is not one the generator wrote. */
function wrapAuthorizer(scope: Scope, file: string, grants: string): boolean {
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

function writeFile(scope: Scope, file: string, content: string): void {
  if (scope.ws.read(file) === undefined) {
    scope.ws.create(file, content);
  } else {
    scope.ws.update(file, content);
  }
}
