import { classesOf } from '../declarations/classes-of';
import { wholeLiteral } from '../declarations/whole-literal';
import { isInProject } from '../authz/is-in-project';
import { ownAuthorizer } from '../authz/own-authorizer';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { perFile } from '../support/per-file';
import { sourceDeclaring } from '../support/source-declaring';
import { callArguments } from '../text/call-arguments';
import { escapeRegExp } from '../text/escape-reg-exp';
import { platformFileIn } from '../../platform-layout';

const SYSTEM_ACTOR = /(?<![\w$.])systemActor\s*\(/g;
const SENT = /\bnew\s+([A-Z][\w$]*(?:Command|Query))\s*\(/g;
const OWN_NAME = /^([A-Z][\w$]*)\.name$/;

/**
 * Under relationships, the application acts on its own behalf as a system actor (a job, an event
 * handler, a process, a consumer), and nothing is permitted to it until a relationship says so:
 * the command it sends is refused at run time with FORBIDDEN, which a spec on a fake authorizer
 * never shows. Judged on every `systemActor(<name>)` of a context outside the tests whose name the
 * checker reads (a string literal or `<Class>.name`) and whose file sends at least one command or
 * query that is not public: the platform file `relate-system-actors.ts` (or any file of
 * `auth/relationships/`) must name the subject `system:system:<name>` (the authorizer reads an actor
 * as `<type>:<id>`, and the id of a system actor is `system:<name>`). Under roles or attributes the right is the
 * permission of the system role or of an attribute rule, not a relationship per actor: not judged.
 * Nor is a project with an authorizer of its own, which may let a system actor operate its context.
 */
export const authzSystemActorGranted: Rule = {
  id: 'authz/system-actor-granted',
  description:
    'Under relationships, every system actor a context acts as is named by a relationship of the platform when it sends a protected command or query.',
  scope: 'project',
  run(project) {
    if (project.config.stack.authz !== 'rebac' || ownAuthorizer(project)) {
      return [];
    }

    const relationships = platformFileIn(project.config, 'auth/relationships/relate-system-actors.ts', (path) =>
      isInProject(project, path),
    );

    if (!isInProject(project, relationships)) {
      return [];
    }

    const folder = `${relationships.slice(0, relationships.lastIndexOf('/'))}/`;
    const files = project.files.filter((file) => !file.isTest && file.path.startsWith(folder));

    return perFile(project, this.id, (file) =>
      file.isTest || file.location.area !== 'context' ? [] : ungranted(project, file, { files, path: relationships }),
    );
  },
};

/** The files of the platform that grant system actors, and the one `generate job` writes in. */
interface Granting {
  readonly files: readonly SourceFile[];
  readonly path: string;
}

function ungranted(project: Project, file: SourceFile, granting: Granting): Finding[] {
  const sent = [...file.scan.code.matchAll(SENT)].map((match) => match[1] ?? '');

  if (sent.length === 0 || sent.every((message) => isPublic(project, file, message))) {
    return [];
  }

  return [...file.scan.code.matchAll(SYSTEM_ACTOR)].flatMap((call) => {
    const name = actorNamed(file, call.index + call[0].length - 1);

    if (name === undefined || granting.files.some((grant) => names(grant, `system:system:${name}`))) {
      return [];
    }

    const misnamed = granting.files.some((grant) => names(grant, `system:${name}`));

    return [
      {
        line: file.scan.lineAt(call.index),
        message: misnamed
          ? `The relationships of the platform name system:${name} without the type of the actor: the authorizer reads a system actor as the subject system:system:${name}, so the grant never matches and the application refuses the command with FORBIDDEN.`
          : `The system actor system:${name} sends a protected message and no relationship of the platform names it: the application refuses it with FORBIDDEN when it runs.`,
        fix: `Add \`{ object: 'context:<context>', relation: 'operator', subject: 'system:system:${name}' }\` to the systemRelationships of ${granting.path} (the subject is the type of the actor, \`system\`, then its id, \`system:${name}\`), or derive the permission on an element the actor is related to: \`generate job\` writes this line for a job, a handler by hand needs it.`,
      },
    ];
  });
}

/** The name given to `systemActor(..)`: a string literal, or the name of a class of the file. */
function actorNamed(file: SourceFile, open: number): string | undefined {
  const argument = callArguments(file.scan.code, open)[0];

  if (argument === undefined) {
    return undefined;
  }

  const literal = wholeLiteral(file.scan, argument);

  if (literal !== undefined) {
    return literal;
  }

  const own = OWN_NAME.exec(argument.code.replace(/\s+/g, ''))?.[1];

  return own !== undefined && classesOf(file.scan).some(({ name }) => name === own) ? own : undefined;
}

/** The file writes `subject` as a whole token, not as the start of a longer name. */
function names(file: SourceFile, subject: string): boolean {
  return new RegExp(`(?<![\\w$.:-])${escapeRegExp(subject)}(?![\\w$.-])`).test(file.text);
}

/** A message anybody may send: `@Public()` on its class, `.public()` after its registration, or `publicUseCase(..)`. */
function isPublic(project: Project, file: SourceFile, message: string): boolean {
  const name = escapeRegExp(message);

  const declared = classesOf(sourceDeclaring(project, file, message).scan).find(
    (candidate) => candidate.name === message,
  );

  if (declared?.decorations.some(({ name: decorator }) => decorator === 'Public') === true) {
    return true;
  }

  const registered = new RegExp(
    `\\.\\s*(?:command|query)\\s*\\(\\s*${name}\\s*\\)\\s*\\.\\s*public\\s*\\(|publicUseCase\\s*\\(\\s*${name}\\b`,
  );

  return project.files.some((candidate) => !candidate.isTest && registered.test(candidate.scan.code));
}
