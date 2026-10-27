import type { Project } from '../model/project';

const BODY = '(?:[^{}]|\\$\\{[^{}]*\\})*';
const QUOTE = '[\'"`]';
const TUPLE = new RegExp(`\\{${BODY}?\\brelation\\s*:\\s*(${QUOTE})operator\\1${BODY}\\}`, 'g');
const OBJECT = /\bobject\s*:\s*(['"`])context:([^'"`]*)\1/;

/** The contexts somebody is made operator of by a relationship written in the sources, outside the tests. */
export interface OperatorTuples {
  /** A tuple whose object the checker cannot read (a computed context): every context may be covered. */
  readonly unreadable: boolean;
  readonly contexts: ReadonlySet<string>;
}

/**
 * The `{ object: 'context:<name>', relation: 'operator', subject: '..' }` tuples the project writes
 * in its sources, tests aside, whoever the subject is: a person, or a system actor whose grant
 * `authz/system-actor-granted` judges (a use case only the system sends is held by it).
 */
export function operatorTuples(project: Project): OperatorTuples {
  const contexts = new Set<string>();
  let unreadable = false;

  for (const file of project.files.filter(({ isTest }) => !isTest)) {
    for (const [tuple] of file.text.matchAll(TUPLE)) {
      const context = OBJECT.exec(tuple)?.[2];

      if (context === undefined || context.includes('${')) {
        unreadable = true;
      } else {
        contexts.add(context);
      }
    }
  }

  return { unreadable, contexts };
}
