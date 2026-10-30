import { insertInRegion } from '../markers';
import type { Scope } from '../generate/scope';
import { renderTemplate } from '../templating';
import { wrapAuthorizer } from './wrap-authorizer';
import { platformPath } from '../generate/platform-path';

const REGION = 'signed-in-grants';

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

function writeFile(scope: Scope, file: string, content: string): void {
  if (scope.ws.read(file) === undefined) {
    scope.ws.create(file, content);
  } else {
    scope.ws.update(file, content);
  }
}
