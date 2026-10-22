import { escapeRegExp } from '../../../check/text/escape-reg-exp';
import { insertInRegion } from '../../../markers';
import { withImport } from '../../with-import';
import { permissionOf, type PermissionReference } from './permission-of';
import type { Scope } from '../../scope';
import type { SentCommand } from './sent-command';
import { platformPath } from '../../platform-path';

const REGION = 'system-grants';
const SYSTEM_OPERATES = /operator:\s*\[[^\]]*'system'/;

export interface SystemGrant {
  /** The generator wrote the grant in the authorization model of the platform. */
  readonly isWritten: boolean;
  /** What the team has to do, said in the job file, when nothing was written. */
  readonly todo: string;
}

/** Where a model holds the grant of a system actor: one line in a marker region, and what the team checks there. */
interface Placement {
  readonly file: string;
  readonly line: string;
  /** What names the grant in the file, however the line was laid out there. */
  readonly anchor: string;
  readonly check: string;
  /** The import the line needs, added to the file when it does not have it. */
  readonly needs?: string;
  /** The same grant as 0.5 wrote it, the permission by its id: a file that holds it already has the grant. */
  readonly writtenBefore?: RegExp;
}

/**
 * Gives the system actor of a job the permission its command requires, where the authorization
 * model of the project makes that one line: a grant of the role of system actors (roles), a rule
 * about this actor (attribute policies), a relationship to its context (relationships). A model
 * of your own, a file whose region was removed or a permission written where the generator
 * cannot read it leave the grant to the team, as a `TODO(domain)` in the job.
 */
export function grantSystemActor(scope: Scope, job: string, command: SentCommand): SystemGrant {
  const required =
    command.permission === undefined
      ? `the permission ${command.name.pascal}Command requires`
      : `the permission \`${command.permission}\``;

  const todo = `grant the system actor \`system:${job}\` ${required} in the authorization model of the platform; until then the command refuses the job with FORBIDDEN.`;
  const placement = command.permission === undefined ? undefined : placementOf(scope, job, command.permission);

  return { isWritten: placement !== undefined && written(scope, placement), todo };
}

function placementOf(scope: Scope, job: string, permission: string): Placement | undefined {
  const actor = `system:${job}`;
  const read: PermissionReference = permissionOf(scope.config, permission);

  switch (scope.config.stack.authz) {
    case 'rbac':
      return {
        file: platformPath(scope, 'auth/roles/roles.ts'),
        line: `${read.written},`,
        anchor: `${read.written},`,
        needs: read.importLine,
        writtenBefore: new RegExp(`'${escapeRegExp(permission)}',`),
        check: `check this grant: the role \`system\`, which every system actor holds, now gives \`${actor}\` the permission \`${permission}\` its command requires.`,
      };
    case 'abac':
      return {
        file: platformPath(scope, 'auth/attributes/attribute-policies.ts'),
        line: `permit('system-${job}', [${read.written}], ({ actor }) => actor.id === '${actor}'),`,
        anchor: `'system-${job}',`,
        needs: read.importLine,
        writtenBefore: new RegExp(`'system-${escapeRegExp(job)}',\\s*\\['${escapeRegExp(permission)}'\\]`),
        check: `check this rule: it permits \`${actor}\`, and nobody else, the permission \`${permission}\` its command requires.`,
      };
    case 'rebac':
      return operatorOfContext(scope, actor, permission);
    default:
      return undefined;
  }
}

/** The starting schema derives every permission of the project from `operator` of its context; once the team has remodelled it, the relationship is theirs to write. */
function operatorOfContext(scope: Scope, actor: string, permission: string): Placement | undefined {
  const context = scope.context.kebab;

  if (!SYSTEM_OPERATES.test(scope.ws.read(platformPath(scope, 'auth/relationships/relationship-schema.ts')) ?? '')) {
    return undefined;
  }

  return {
    file: platformPath(scope, 'auth/relationships/relate-system-actors.ts'),
    line: `{ object: 'context:${context}', relation: 'operator', subject: 'system:${actor}' },`,
    anchor: `subject: 'system:${actor}'`,
    check: `check this relationship: \`${actor}\` now operates the context \`${context}\`, which gives it \`${permission}\` and every permission the schema derives from \`operator\` there.`,
  };
}

function written(scope: Scope, placement: Placement): boolean {
  const { file, anchor, check } = placement;
  const next = withGrant(scope.ws.read(file), placement);

  if (next === undefined) {
    return false;
  }

  scope.ws.update(file, next);
  scope.ws.step({ file, anchor, text: check });

  return true;
}

function withGrant(content: string | undefined, { line, needs, writtenBefore }: Placement): string | undefined {
  if (content !== undefined && writtenBefore?.test(content) === true) {
    return content;
  }

  const inserted = content === undefined ? undefined : insertInRegion(content, REGION, line);

  return inserted === undefined || needs === undefined ? inserted : withImport(inserted, needs);
}
