import { isGeneratedTitle } from '../docs/is-generated-title';
import { readableTitle } from '../docs/readable-title';
import { type RuleGroup, rulesIn, type SpecRules, type StatedRule } from '../docs/rules-in';
import { specSubject } from '../docs/spec-subject';
import type { ChangedPath } from './changed-path';
import type { NewSpecTitles } from './digest';
import type { ProjectTree } from './project-tree';

const SPEC = /\.spec\.ts$/;

/** A rule of a spec and where it is: the titles of the `describe` calls that hold it, then its own. */
interface PlacedRule {
  readonly rule: StatedRule;
  readonly place: string;
}

/**
 * The titles each spec of the branch states that the same file did not state at the base, read as
 * the behaviour pages read them, without running a test: those written for the project listed,
 * those a template of the kit wrote counted. A rule is the same when its title and the titles of
 * the `describe` calls that hold it are.
 */
export function newSpecTitles(
  trees: readonly [ProjectTree, ProjectTree],
  paths: readonly ChangedPath[],
): NewSpecTitles[] {
  const [before, after] = trees;

  return paths
    .filter((changed) => changed.change !== 'removed' && SPEC.test(changed.path))
    .flatMap(({ path }) => {
      const stated = new Set(placed(rulesIn(before.ws.read(path) ?? '')).map((rule) => rule.place));
      const fresh = placed(rulesIn(after.ws.read(path) ?? '')).filter((rule) => !stated.has(rule.place));
      const role = specSubject(path).role;
      const written = fresh.filter(({ rule }) => !isGeneratedTitle(role, rule.title));

      return fresh.length === 0
        ? []
        : [
            {
              file: path,
              titles: written.map(({ rule }) => ({ title: readableTitle(rule.title), state: rule.state })),
              generated: fresh.length - written.length,
            },
          ];
    });
}

function placed(rules: SpecRules, above = ''): PlacedRule[] {
  return [
    ...rules.rules.map((rule) => ({ rule, place: `${above}${rule.title}` })),
    ...rules.groups.flatMap((group: RuleGroup) => placed(group, `${above}${group.title} > `)),
  ];
}
