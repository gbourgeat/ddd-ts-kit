import { type ModelledPermission, modelledPermissions } from '../authz/modelled-permissions';
import { isInProject } from '../authz/is-in-project';
import { type PermissionSet, permissionSets } from '../authz/permission-sets';
import { scopedPermission } from '../authz/scoped-permission';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { Report } from '../model/report';
import type { Rule } from '../model/rule';
import type { Violation } from '../model/violation';
import type { SourceFile } from '../model/source-file';
import { reporter } from '../support/reporter';
import { toViolations } from '../support/to-violations';
import { callArguments } from '../text/call-arguments';
import type { ListPart } from '../text/list-part';
import { platformFileIn } from '../../platform-layout';

/** `@Requires(`, `.requires(` and the `requires(` of an explicit module, the opening parenthesis last. */
const REQUIREMENT = /(?:@Requires|\.requires|\brequires)\s*\(/g;
const SCOPE_CALL = /([\w$.]*)\.scope\s*\(/g;
const RESOURCE = /^resource\s*:\s*/;
const TYPE = /\btype\s*:\s*(['"`])([\w-]+)\1/;

/**
 * Under relationships, a requirement names the element its permission is checked on. A permission
 * the relationship schema derives on an element type is not held on the context (the operators
 * of the context do not have it): a requirement whose resource is `{ type: 'context' }` for it is
 * refused at run time, or, if the project's bridge grants it widely, granted to everybody. Judged:
 * the permissions the types other than `context` derive in the schema file of the platform, against
 * the resource of every `@Requires`, `.requires(` and `requires(` outside the tests. What it cannot
 * read is said, never taken as safe: a schema built by a call or spread, a key computed in another
 * way, a resource that is not an object literal with a literal `type`.
 */
export const authzResourceModelled: Rule = {
  id: 'authz/resource-modelled',
  description:
    'Under relationships, a requirement names the element its permission is derived on in the relationship schema, never the context.',
  scope: 'project',
  run(project) {
    const schemaFile = schemaOf(project);

    return schemaFile === undefined ? [] : judged(project, schemaFile, reporter(project, this.id));
  },
};

/** The relationship schema of the platform, when the project's rights are relationships and it holds one. */
function schemaOf(project: Project): SourceFile | undefined {
  if (project.config.stack.authz !== 'rebac') {
    return undefined;
  }

  const path = platformFileIn(project.config, 'auth/relationships/relationship-schema.ts', (candidate) =>
    isInProject(project, candidate),
  );

  return project.files.find((file) => file.path === path);
}

function judged(project: Project, schemaFile: SourceFile, report: Report): Violation[] {
  const sources = project.files.filter((file) => !file.isTest && file.location.area === 'context');
  const sets = sources.flatMap(permissionSets);
  const schema = modelledPermissions(schemaFile, sets);
  const searched = searchedPermissions(sources, sets);
  const contextHolds = (id: string): boolean => schema.contextHolds(id);

  return [
    ...schema.unread.map(({ line, what }) =>
      report(
        { file: schemaFile.path, line },
        `The checker cannot read the relationship schema: ${what}, so it cannot tell which permissions an element derives.`,
        "Write the types as an object literal given to defineSchema, the elements in an `elements` object of the file, and name each derived permission as `[<context>Permissions['<permission>'].id]` or by its id (`'<context>:<permission>'`).",
      ),
    ),
    ...sources.flatMap((file) =>
      toViolations(
        report,
        file.path,
        unnamedElements(file, { sets, modelled: schema.modelled, searched, contextHolds }),
      ),
    ),
  ];
}

interface Judged {
  readonly sets: readonly PermissionSet[];
  readonly modelled: readonly ModelledPermission[];
  /** The ids of the permissions a handler narrows a search by. */
  readonly searched: ReadonlySet<string>;
  /** Whether the operators of the context hold a permission. */
  readonly contextHolds: (id: string) => boolean;
}

function unnamedElements(file: SourceFile, judged: Judged): Finding[] {
  const { code } = file.scan;

  return [...code.matchAll(REQUIREMENT)].flatMap((call) => {
    const parts = callArguments(code, call.index + call[0].length - 1);

    return judgeRequirement(file, parts, { ...judged, line: file.scan.lineAt(call.index) });
  });
}

function judgeRequirement(file: SourceFile, parts: readonly ListPart[], judged: Judged & { line: number }): Finding[] {
  const { sets, modelled, searched, contextHolds, line } = judged;
  const at = parts.findIndex((part) => scopedPermission(file, part, sets) !== undefined);
  const permission = parts[at] === undefined ? undefined : scopedPermission(file, parts[at], sets);

  if (permission === undefined) {
    return [];
  }

  const id = `${permission.set.context}:${permission.key}`;
  const type = modelled.find((entry) => entry.id === id)?.type;

  if (type === undefined) {
    return [];
  }

  const resource = resourceNamed(file, parts.slice(at + 1));
  const naming = namingElement(permission.set.set, permission.key, type);

  if (resource === undefined) {
    return [{ line, message: unreadResource(id, type), fix: naming }];
  }

  if (resource !== 'context') {
    return [];
  }

  if (searched.has(id) && contextHolds(id)) {
    return [];
  }

  return [
    searched.has(id) ? { line, ...sharedWithSearch(id, type) } : { line, message: onTheContext(id, type), fix: naming },
  ];
}

/** The type the options of a requirement give its resource, undefined when they do not say it in a way the checker reads. */
function resourceNamed(file: SourceFile, rest: readonly ListPart[]): string | undefined {
  const options = rest.find(({ code }) => code.startsWith('{'));

  return options === undefined ? undefined : resourceOf(file, options.start);
}

function onTheContext(id: string, type: string): string {
  return `${id} is checked on the context, but the relationship schema derives it on \`${type}\`: the rule on \`${type}\` is never asked, whoever holds the permission on the context passes.`;
}

function sharedWithSearch(id: string, type: string): { message: string; fix: string } {
  return {
    message: `${id} is checked on the context, and a search narrows by the same permission, which the schema derives on \`${type}\`: the operators of the context do not hold it, so the gate refuses everybody.`,
    fix: `Use two permissions: this one, held on the context, to run the search (leave it out of the derived relations of \`${type}\`), and another, derived on \`${type}\`, for the scope (\`Access.scope(actor, <context>Permissions['<element>.view'], '${type}')\`).`,
  };
}

function unreadResource(id: string, type: string): string {
  return `${id} is derived on \`${type}\` by the relationship schema, and the checker cannot read the resource of this requirement (it is not an object literal with a literal \`type\`), so it cannot tell whether it names \`${type}\`.`;
}

function namingElement(set: string, key: string, type: string): string {
  return `Name the ${type} in the requirement, \`@Requires(${set}['${key}'], { resource: (message) => ({ type: '${type}', id: message.${type}Id }) })\`, as an object literal with a literal \`type\`.`;
}

/** The type a requirement names: the literal `type` of its `resource`, undefined when it cannot be read. */
function resourceOf(file: SourceFile, open: number): string | undefined {
  const resource = callArguments(file.scan.code, open).find(({ code }) => RESOURCE.test(code));

  if (resource === undefined) {
    return undefined;
  }

  return TYPE.exec(file.text.slice(resource.start, resource.start + resource.code.length))?.[2];
}

/** The ids of the permissions a `.scope(` call of a handler narrows by. */
function searchedPermissions(sources: readonly SourceFile[], sets: readonly PermissionSet[]): ReadonlySet<string> {
  const ids = new Set<string>();

  for (const file of sources) {
    for (const call of file.scan.code.matchAll(SCOPE_CALL)) {
      const argument = callArguments(file.scan.code, call.index + call[0].length - 1)[1];
      const permission = argument === undefined ? undefined : scopedPermission(file, argument, sets);

      if (permission !== undefined) {
        ids.add(`${permission.set.context}:${permission.key}`);
      }
    }
  }

  return ids;
}
