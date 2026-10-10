import { insertInRegion } from '../../../markers/index.js';
import type { Scope } from '../../scope.js';
import type { SentCommand } from './sent-command.js';

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
  readonly check: string;
}

/**
 * Gives the system actor of a job the permission its command requires, where the authorization
 * model of the project makes that one line: a grant of the role of system actors (roles), a rule
 * about this actor (attribute policies), a relationship to its context (relationships). A model
 * of your own, a file whose region was removed or a permission written where the generator
 * cannot read it leave the grant to the team, as a `TODO(domain)` in the job.
 */
export function grantSystemActor(scope: Scope, job: string, command: SentCommand): SystemGrant {
  const required = command.permission === undefined ? `the permission ${command.name.pascal}Command requires` : `the permission \`${command.permission}\``;
  const todo = `grant the system actor \`system:${job}\` ${required} in the authorization model of the platform; until then the command refuses the job with FORBIDDEN.`;
  const placement = command.permission === undefined ? undefined : placementOf(scope, job, command.permission);

  return { isWritten: placement !== undefined && written(scope, placement), todo };
}

function placementOf(scope: Scope, job: string, permission: string): Placement | undefined {
  const auth = `${scope.config.platformDir}/auth`;
  const actor = `system:${job}`;

  switch (scope.config.stack.authz) {
    case 'rbac':
      return { file: `${auth}/roles.ts`, line: `'${permission}',`, check: `check this grant: the role \`system\`, which every system actor holds, now gives \`${actor}\` the permission \`${permission}\` its command requires.` };
    case 'abac':
      return {
        file: `${auth}/attribute-policies.ts`,
        line: `permit('system-${job}', ['${permission}'], ({ actor }) => actor.id === '${actor}'),`,
        check: `check this rule: it permits \`${actor}\`, and nobody else, the permission \`${permission}\` its command requires.`,
      };
    case 'rebac':
      return operatorOfContext(scope, actor, permission);
    default:
      return undefined;
  }
}

/** The starting schema maps every permission of a context to `operate`; once the team has remodelled it, the relationship is theirs to write. */
function operatorOfContext(scope: Scope, actor: string, permission: string): Placement | undefined {
  const auth = `${scope.config.platformDir}/auth`;
  const context = scope.context.kebab;

  if (!SYSTEM_OPERATES.test(scope.ws.read(`${auth}/relationship-schema.ts`) ?? '')) return undefined;

  return {
    file: `${auth}/relate-system-actors.ts`,
    line: `{ object: 'context:${context}', relation: 'operator', subject: 'system:${actor}' },`,
    check: `check this relationship: \`${actor}\` now operates the context \`${context}\`, which gives it \`${permission}\` and every other permission mapped to \`operate\`.`,
  };
}

function written(scope: Scope, { file, line, check }: Placement): boolean {
  const content = scope.ws.read(file);
  const next = content === undefined ? undefined : insertInRegion(content, REGION, line);

  if (next === undefined) return false;

  scope.ws.update(file, next);
  scope.ws.step({ file, anchor: line, text: check });

  return true;
}
