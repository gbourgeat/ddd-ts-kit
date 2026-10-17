import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inContext } from '../support/in-context.js';
import { perFile } from '../support/per-file.js';

/** The folders of a context that hold specs, and nothing else. */
const SPEC_FOLDERS = new Set(['unit', 'integration']);

/** A spec, as the test runners of the kit find one; a declaration file holds no code. */
const NOT_A_HELPER = /\.(?:spec|test|d)\.ts$/;

export const testHelperPlaced: Rule = {
  id: 'test/helper-placed',
  description:
    "A file of a context's test/unit/ or test/integration/ is a spec: an arrangement several specs share is a world of test/worlds/, test data a builder of test/builders/, an in-memory port a fake of test/fakes/.",
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const helper = helperOf(file);

      if (helper === undefined) {
        return [];
      }

      const { context, place } = helper;

      return [
        {
          line: 1,
          message: `"${place}" is a helper among the specs of the context ${context}.`,
          fix: `Move it to test/worlds/ (an arrangement several specs share: \`npx ddd-ts-kit generate test-world ${context}\` writes one), test/builders/ (test data) or test/fakes/ (an in-memory port).`,
        },
      ];
    });
  },
};

interface Helper {
  readonly context: string;
  /** The path of the file inside its context. */
  readonly place: string;
}

/** A file that sits among the specs of its context without being one. */
function helperOf(file: SourceFile): Helper | undefined {
  const { location } = file;

  if (!inContext(location) || location.layer !== 'test') {
    return undefined;
  }

  const [folder = '', ...rest] = location.inside;
  const name = rest.at(-1) ?? '';

  if (!SPEC_FOLDERS.has(folder) || !name.endsWith('.ts') || NOT_A_HELPER.test(name)) {
    return undefined;
  }

  return { context: location.context, place: `test/${location.inside.join('/')}` };
}
