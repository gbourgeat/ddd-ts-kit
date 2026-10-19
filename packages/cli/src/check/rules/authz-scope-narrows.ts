import { isGranted } from '../authz/is-granted.js';
import { type PermissionSet, permissionSets } from '../authz/permission-sets.js';
import { scopedPermission } from '../authz/scoped-permission.js';
import { type SignedInGrantSources, signedInGrantSources } from '../authz/signed-in-grant-sources.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import type { Scan } from '../scan/scan.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';
import { callArguments } from '../text/call-arguments.js';

/** `<receiver>.scope(`, the opening parenthesis last. */
const SCOPE_CALL = /([\w$.]*)\.scope\s*\(/g;
/** The port `Access` as a handler holds it: `this.access`, `access`. */
const ACCESS = /(?:^|\.)access$/i;

/**
 * A search narrows by the scope of a permission the model decides. Every signed-in person holds
 * the grants of `SignedInGrantsAuthorizer` whatever the model, and it lists them `all` before it
 * asks the model: a handler that asks `Access.scope` about one of them reads every element for
 * every person who signed in. Judged: the second argument of a `.scope(` call in a context, the
 * entry of a permission set written in place or held in a constant or a field of the file, against
 * the grants file of the platform and the grants given to every `new SignedInGrantsAuthorizer`.
 * What it cannot read is said, never taken as safe: grants built by a call, a permission handed in.
 */
export const authzScopeNarrows: Rule = {
  id: 'authz/scope-narrows',
  description:
    'A search narrows by the scope of a permission the model decides, never by one every signed-in person holds: that scope is always all.',
  scope: 'project',
  run(project) {
    const sources = signedInGrantSources(project);

    if (sources.lists.length === 0 && sources.unread.length === 0) {
      return [];
    }

    const sets = project.files.filter((file) => file.location.area === 'context').flatMap(permissionSets);
    const report = reporter(project, this.id);

    return [
      ...sources.unread.map(({ file, line }) =>
        report(
          { file: file.path, line },
          'The grants of this SignedInGrantsAuthorizer are neither an array literal nor a constant declared as one: the checker cannot tell which searches they widen to all.',
          `Write them in ${project.config.platformDir}/auth/signed-in-grants.ts, \`export const signedInGrants: readonly Grant[] = [...]\`, and pass \`grants: signedInGrants\`.`,
        ),
      ),
      ...project.files
        .filter((file) => !file.isTest && file.location.area === 'context')
        .flatMap((file) => toViolations(report, file.path, widenedScopes(file, { sources, sets }))),
    ];
  },
};

interface Judged {
  readonly sources: SignedInGrantSources;
  readonly sets: readonly PermissionSet[];
}

function widenedScopes(file: SourceFile, { sources, sets }: Judged): Finding[] {
  const { code } = file.scan;

  return [...code.matchAll(SCOPE_CALL)].flatMap((call): Finding[] => {
    const argument = callArguments(code, call.index + call[0].length - 1)[1];
    const permission = argument === undefined ? undefined : scopedPermission(file, argument, sets);
    const line = file.scan.lineAt(call.index);

    if (permission === undefined) {
      return argument === undefined || !ACCESS.test(call[1] ?? '') ? [] : [unreadPermission(line, argument.code)];
    }

    const { set, key } = permission;

    if (!sources.lists.some((list) => isGranted(list, set, key) || grantsEverything(list))) {
      return [];
    }

    return [
      {
        line,
        message: `${set.context}:${key} is held by every signed-in person: its scope is always all, so every person who signed in reads every element.`,
        fix: `Leave ${set.set}['${key}'] out of what every signed-in person holds (the wildcard '${set.context}:*' holds it too: name the other permissions instead) and let the model decide it: under relationships, the requirement names an enclosing resource (the context, or the tenant) and Access.scope answers the ids of the elements. When every signed-in person may indeed read every element, the scope says nothing: the reader is handed everything.`,
      },
    ];
  });
}

function unreadPermission(line: number, argument: string): Finding {
  return {
    line,
    message: `The permission this search narrows by, \`${argument}\`, is not one the checker can read: it cannot tell whether every signed-in person holds it, in which case the scope would be all.`,
    fix: "Name it in the call as the entry of its set, `billingPermissions['invoice.read']`, or in a constant or a field of this file initialised with one.",
  };
}

/** The bare `*`: every permission of every context. */
function grantsEverything(list: Scan): boolean {
  return list.strings.some(({ value }) => value === '*');
}
