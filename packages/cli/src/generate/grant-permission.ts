import { specifierOf } from '../alias/index.js';
import { matchingBracket } from '../check/text/matching-bracket.js';
import { CliError } from '../cli-error.js';
import { permissionsFile } from './permissions-file.js';
import type { Scope } from './scope.js';
import { declareRole } from './vocabulary/declare-role.js';
import { withImport } from './with-import.js';

const ROLES = /export\s+const\s+roles\b[^=]*=\s*\{/;
const IMPORTS_ROLE = /import\s*\{[^}]*\bRole\b[^}]*\}\s*from/;

/**
 * Who holds a new permission, in a project whose rights are roles. With `--grant <role>`, the role
 * holds it in the roles of the platform, by the entry of the permission set: the role joins the
 * role vocabulary when it is new. Without it, the next steps say the grant is left to do, since
 * only the super-admin wildcard reaches the permission until then (rule authz/granted).
 */
export function grantPermission(scope: Scope, permission: string): void {
  const role = scope.flags.grant;
  const file = `${scope.config.platformDir}/auth/roles.ts`;

  if (scope.config.stack.authz !== 'rbac') {
    refuseGrantOutsideRoles(scope, role);

    return;
  }

  const content = scope.ws.read(file);
  const set = `${scope.context.camel}Permissions`;
  const entry = `${set}['${permission}']`;

  if (content === undefined) {
    if (role !== undefined) {
      throw new CliError(
        `--grant writes in ${file}, which this project does not have.`,
        'Grant the permission where your project keeps its roles, then run the command again without --grant.',
      );
    }

    return;
  }

  if (role === undefined) {
    if (!isGranted(content, { context: scope.context.kebab, permission, entry })) {
      scope.ws.step({
        file,
        anchor: 'export const roles',
        text: `grant ${entry} by name to the roles that hold it (or generate with --grant <role>): until then only the super-admin wildcard '*' reaches it (rule authz/granted).`,
      });
    }

    return;
  }

  write(scope, { file, content, entry, set, role, permission });
}

function refuseGrantOutsideRoles(scope: Scope, role: string | undefined): void {
  if (role === undefined) {
    return;
  }

  throw new CliError(
    `--grant writes a grant of the roles of the platform, and the rights of this project are not roles (stack.authz is "${scope.config.stack.authz}").`,
    'Give the right in the model of the project (the attribute policies, a relationship, or the authorizer of the project), and run the command again without --grant.',
  );
}

function isGranted(
  content: string,
  { context, permission, entry }: { context: string; permission: string; entry: string },
): boolean {
  return (
    content.includes(entry) || content.includes(`'${context}:${permission}'`) || content.includes(`'${context}:*'`)
  );
}

interface Grant {
  readonly file: string;
  readonly content: string;
  readonly entry: string;
  readonly set: string;
  readonly role: string;
  readonly permission: string;
}

function write(scope: Scope, { file, content, entry, set, role, permission }: Grant): void {
  const declared = declareRole(scope, role);
  const key = `[Role.${declared.key}]`;
  const granted = withGrant(content, key, entry);

  if (granted === undefined) {
    throw new CliError(
      `${file} holds no \`export const roles = { ... }\` the generator can read.`,
      `Grant ${entry} to the role ${role} by hand, then run the command again without --grant.`,
    );
  }

  const permissions = `${scope.config.contextsDir}/${scope.context.kebab}/${permissionsFile(scope.context)}`;

  const withSet = new RegExp(`import\\s*\\{[^}]*\\b${set}\\b`).test(granted)
    ? granted
    : withImport(granted, `import { ${set} } from '${specifierOf(scope.config, permissions)}';`);

  const next = IMPORTS_ROLE.test(withSet)
    ? withSet
    : withImport(withSet, `import { Role } from '${declared.specifier}';`);

  scope.ws.update(file, next);

  scope.ws.step({
    file,
    anchor: key,
    text: `check this grant: the role ${role} now holds ${scope.context.kebab}:${permission}.`,
  });
}

/** The roles with the entry granted to the role of the key: in its list when it has one, else on a line of its own before the role of system actors or at the end. */
function withGrant(content: string, key: string, entry: string): string | undefined {
  const found = ROLES.exec(content);

  if (found === null) {
    return undefined;
  }

  const open = found.index + found[0].length - 1;
  const close = matchingBracket(content, open);
  const at = content.indexOf(key, open);

  if (at !== -1 && at < close) {
    return inList(content, content.indexOf('[', at + key.length), entry);
  }

  const system = content.indexOf('[Role.System]', open);

  const before =
    system !== -1 && system < close ? content.lastIndexOf('\n', system) + 1 : content.lastIndexOf('\n', close) + 1;

  const indent = /^[ \t]*/.exec(content.slice(before))?.[0] || '  ';

  return `${content.slice(0, before)}${indent}${key}: [${entry}],\n${content.slice(before)}`;
}

function inList(content: string, open: number, entry: string): string {
  const close = matchingBracket(content, open);
  const inside = content.slice(open + 1, close);

  if (inside.includes(entry)) {
    return content;
  }

  if (inside.includes('\n')) {
    const lineStart = content.lastIndexOf('\n', open) + 1;
    const indent = /^[ \t]*/.exec(content.slice(lineStart))?.[0] ?? '';

    return `${content.slice(0, open + 1)}\n${indent}  ${entry},${content.slice(open + 1)}`;
  }

  const items = inside.trim().replace(/,\s*$/, '');

  return `${content.slice(0, open + 1)}${items === '' ? entry : `${items}, ${entry}`}${content.slice(close)}`;
}
