import { argumentsOf } from '../declarations/arguments-of';
import { classesOf } from '../declarations/classes-of';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { inLayer } from '../support/in-layer';
import { reporter } from '../support/reporter';
import { sourceDeclaring } from '../support/source-declaring';
import { toViolations } from '../support/to-violations';
import { callArguments } from '../text/call-arguments';
import { escapeRegExp } from '../text/escape-reg-exp';
import { exportedClass } from '../text/exported-class';
import type { ListPart } from '../text/list-part';
import { statementEnd } from '../text/statement-end';

const PERMISSION_REF = /^([A-Za-z_$][\w$]*)\s*(?:\[\s*(['"`])([^'"`]+)\2\s*\]|\.\s*([A-Za-z_$][\w$]*))$/;
const DEFINE_POLICY = /(?<![\w$.])definePolicy\s*(?:<[^<>()]*>)?\s*\(/g;
const PERMISSION_ENTRY = /^permission\s*:\s*/;
const REGISTRATION = /\.\s*(?:command|query)\s*\(\s*([A-Z][\w$]*)\s*\)/g;
const CHAINED_REQUIRES = /\.\s*requires\s*\(/;
const MAP_REQUIRES = /(?<![\w$.])requires\s*\(/g;
const ASKS_ACCESS = /\.\s*(?:authorize|decide|decideOn)\s*\(/;
const LEFT_TO_DO = /\bTODO\((?:domain|review)\)/;

export const authzPolicyAsked: Rule = {
  id: 'authz/policy-asked',
  description:
    'A use case whose permission has a policy has a handler that asks it through Access, with that permission.',
  scope: 'project',
  run(project) {
    const refined = refinedPermissions(project);
    const report = reporter(project, this.id);

    if (refined.size === 0) {
      return [];
    }

    return requirements(project)
      .filter(({ permission }) => refined.has(permission.key))
      .flatMap((requirement) =>
        handlersOf(project, requirement).flatMap((handler) =>
          toViolations(
            report,
            handler.path,
            unasked(handler, requirement, refined.get(requirement.permission.key) ?? []),
          ),
        ),
      );
  },
};

/** A permission named as `<set>['<id>']` or `<set>.<id>`, the way a permission set is read. */
interface PermissionRef {
  readonly set: string;
  readonly id: string;
  readonly key: string;
  readonly written: string;
}

/** A command or query that requires a permission, and where it was said. */
interface Requirement {
  readonly message: string;
  readonly permission: PermissionRef;
  readonly declaredIn: SourceFile;
}

/** The permissions some policy refines, by `@Policy(<permission>, ...)` or `definePolicy({ permission, ... })`. */
function refinedPermissions(project: Project): ReadonlyMap<string, readonly string[]> {
  const refined = new Map<string, string[]>();

  for (const file of project.files) {
    if (inLayer(file, 'application')?.inside[0] !== 'authorization') {
      continue;
    }

    for (const permission of [...decoratedPolicies(file), ...definedPolicies(file)]) {
      refined.set(permission.key, [...(refined.get(permission.key) ?? []), file.path]);
    }
  }

  return refined;
}

function decoratedPolicies(file: SourceFile): PermissionRef[] {
  return classesOf(file.scan).flatMap(({ decorations }) =>
    decorations.flatMap((decoration) => {
      const [permission] = decoration.name === 'Policy' ? argumentsOf(file.scan, decoration) : [];

      return refOf(file, permission);
    }),
  );
}

/** The permission of `definePolicy({ permission, ... })`, read from the object written as its first argument only. */
function definedPolicies(file: SourceFile): PermissionRef[] {
  const { code } = file.scan;

  return [...code.matchAll(DEFINE_POLICY)].flatMap((match) => {
    const [options] = callArguments(code, match.index + match[0].length - 1);

    const entry =
      options?.code.startsWith('{') === true
        ? callArguments(code, options.start).find((part) => PERMISSION_ENTRY.test(part.code))
        : undefined;

    if (entry === undefined) {
      return [];
    }

    const value = PERMISSION_ENTRY.exec(entry.code)?.[0].length ?? 0;

    return refOf(file, { code: entry.code.slice(value), start: entry.start + value });
  });
}

/** Every use case that requires a permission: `@Requires` on its class, or its registration in a module or a map. */
function requirements(project: Project): Requirement[] {
  return project.files.flatMap((file) => {
    if (file.isTest || file.location.area !== 'context') {
      return [];
    }

    return [...decoratedRequirements(file), ...registeredRequirements(file), ...mappedRequirements(file)];
  });
}

function decoratedRequirements(file: SourceFile): Requirement[] {
  return classesOf(file.scan).flatMap(({ name, decorations }) =>
    decorations.flatMap((decoration) => {
      const [permission] = decoration.name === 'Requires' ? argumentsOf(file.scan, decoration) : [];

      return refOf(file, permission).map((ref) => ({ message: name, permission: ref, declaredIn: file }));
    }),
  );
}

/** `.command(X).requires(<permission>)` in a module wired by hand with the builder. */
function registeredRequirements(file: SourceFile): Requirement[] {
  const { code } = file.scan;

  if (file.location.area !== 'context' || file.location.layer !== 'module') {
    return [];
  }

  const registrations = [...code.matchAll(REGISTRATION)];

  return registrations.flatMap((match, index) => {
    const next = registrations[index + 1]?.index ?? code.length;
    const end = Math.min(next, statementEnd(code, match.index));
    const chained = CHAINED_REQUIRES.exec(code.slice(match.index, end));

    if (chained === null) {
      return [];
    }

    const open = match.index + chained.index + chained[0].length - 1;
    const [permission] = callArguments(code, open);

    return refOf(file, permission).map((ref) => ({ message: match[1] ?? '', permission: ref, declaredIn: file }));
  });
}

/** `requires(X, <permission>)` in the authorization map of a module wired by hand. */
function mappedRequirements(file: SourceFile): Requirement[] {
  const { code } = file.scan;
  const here = file.location;

  if (here.area !== 'context' || (here.layer !== 'module' && !isAuthorizationFolder(file))) {
    return [];
  }

  return [...code.matchAll(MAP_REQUIRES)].flatMap((match) => {
    const [message, permission] = callArguments(code, match.index + match[0].length - 1);

    if (message === undefined || !/^[A-Z][\w$]*$/.test(message.code)) {
      return [];
    }

    return refOf(file, permission).map((ref) => ({ message: message.code, permission: ref, declaredIn: file }));
  });
}

function isAuthorizationFolder(file: SourceFile): boolean {
  return inLayer(file, 'application')?.inside[0] === 'authorization';
}

/** The permission an argument names, read from the source: the code has the contents of its strings blanked. */
function refOf(file: SourceFile, argument: ListPart | undefined): PermissionRef[] {
  if (argument === undefined) {
    return [];
  }

  const written = file.text.slice(argument.start, argument.start + argument.code.length).trim();
  const match = PERMISSION_REF.exec(written);
  const set = match?.[1];
  const id = match?.[3] ?? match?.[4];

  return set === undefined || id === undefined ? [] : [{ set, id, key: `${set}[${id}]`, written }];
}

/** The handlers in the folder of the use case: `commands/<use-case>/` or `queries/<use-case>/`. */
function handlersOf(project: Project, { message, declaredIn }: Requirement): SourceFile[] {
  const source = messageSource(project, declaredIn, message);

  if (source === undefined) {
    return [];
  }

  const folder = source.path.slice(0, source.path.lastIndexOf('/') + 1);

  return project.files.filter(
    (file) =>
      !file.isTest &&
      file.path.startsWith(folder) &&
      !file.path.slice(folder.length).includes('/') &&
      file.path.endsWith('.handler.ts'),
  );
}

function messageSource(project: Project, declaredIn: SourceFile, message: string): SourceFile | undefined {
  const declaring = sourceDeclaring(project, declaredIn, message);

  if (declares(declaring, message)) {
    return declaring;
  }

  const context = declaredIn.location.area === 'context' ? declaredIn.location.context : undefined;

  return project.files.find(
    (file) =>
      !file.isTest &&
      file.location.area === 'context' &&
      file.location.context === context &&
      /\.(?:command|query)\.ts$/.test(file.path) &&
      declares(file, message),
  );
}

function declares(file: SourceFile, name: string): boolean {
  return classesOf(file.scan).some((candidate) => candidate.name === name);
}

function unasked(
  handler: SourceFile,
  { message, permission, declaredIn }: Requirement,
  policies: readonly string[],
): Finding[] {
  if (asks(handler, permission)) {
    return [];
  }

  const handlerClass = exportedClass(handler);

  return [
    {
      line: handlerClass?.line ?? 1,
      message: `A policy refines ${permission.written}, which ${message} requires, and ${handlerClass?.name ?? 'its handler'} never asks it: the bus checked the permission without the element, and the rule of the policy is skipped.`,
      fix: `Load the element, then call \`await this.access.authorize(${/Query$/.test(message) ? 'query' : 'command'}.actor, ${permission.written}, <aggregate>)\` with the Access port of @ddd-ts-kit/auth, before the change.`,
      subjects: [...new Set([declaredIn.path, ...policies])].filter((path) => path !== handler.path),
    },
  ];
}

/**
 * A call to `authorize`, `decide` or `decideOn` of `Access`, and the permission named in the
 * code, not in a comment; or the `TODO(domain)` the generator leaves there, or a `TODO(review)`,
 * naming the permission, which `ddd-ts-kit todo` lists and the authorization module enforces at
 * run time until it is done.
 */
function asks(handler: SourceFile, permission: PermissionRef): boolean {
  const { code, comments } = handler.scan;
  const set = escapeRegExp(permission.set);
  const id = escapeRegExp(permission.id);
  const named = new RegExp(`(?<![\\w$.])${set}\\s*(?:\\[\\s*(['"\`])${id}\\1\\s*\\]|\\.\\s*${id}(?![\\w$]))`, 'g');

  if (comments.some(({ text }) => LEFT_TO_DO.test(text) && new RegExp(named.source).test(text))) {
    return true;
  }

  return (
    ASKS_ACCESS.test(code) &&
    [...handler.text.matchAll(named)].some(
      (match) => code.slice(match.index, match.index + permission.set.length) === permission.set,
    )
  );
}
