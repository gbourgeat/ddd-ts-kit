import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import type { SourceFile } from '../src/check/model/source-file';
import { loadSourceFile } from '../src/check/project/load-source-file';
import { DeclaredClasses } from '../src/read-models/declared-classes';
import { ListAnswers } from '../src/read-models/list-answers';
import { readModelListOf } from '../src/read-models/read-model-list-of';
import { readModelStoresOf } from '../src/read-models/read-model-stores-of';

const STORES = 400;

const CONFIG = parseConfig({
  importExtension: 'none',
  contexts: { billing: { classification: 'core', upstreams: [] } },
});

const PERSISTENCE = 'src/contexts/billing/infrastructure/persistence';

/** What the reading asked of the sources: how often a declaration was read, a file parsed, the list scanned. */
interface Work {
  shapes: number;
  structures: number;
  listScans: number;
}

/** A source whose declarations count each reading of one of their properties, and each reading of the file itself. */
function counted(file: SourceFile, work: Work, isList = false): SourceFile {
  const counting = <T extends object>(read: T): T =>
    new Proxy(read, {
      get(target, property, receiver): unknown {
        work.shapes += 1;

        return Reflect.get(target, property, receiver);
      },
    });

  return {
    ...file,
    get structure() {
      work.structures += 1;

      return { ...file.structure, classes: file.structure.classes.map(counting) };
    },
    get scan() {
      work.listScans += isList ? 1 : 0;

      return file.scan;
    },
  };
}

describe('the read model stores of a large tree: the work grows with the tree, not with its square', () => {
  it('reads each source and the list once, and each declaration a bounded number of times, for hundreds of listed stores', () => {
    const work: Work = { shapes: 0, structures: 0, listScans: 0 };
    const names = Array.from({ length: STORES }, (_, at) => `KnexTotals${at}`);

    const sources = names.map((name, at) =>
      loadSourceFile(
        CONFIG,
        `${PERSISTENCE}/knex-totals-${at}.repository.ts`,
        // Every other store extends the one before it, so that lineages are walked too.
        `export class ${name} extends ${at % 2 === 1 ? `KnexTotals${at - 1}` : 'KnexReadModelStore<Total>'} {\n  constructor(database: KnexContext) {\n    super(database);\n  }\n}\n`,
      ),
    );

    const list = loadSourceFile(
      CONFIG,
      'src/platform/database/read-model-tables.ts',
      [
        ...names.map(
          (name, at) =>
            `import { ${name} } from '@/contexts/billing/infrastructure/persistence/knex-totals-${at}.repository';`,
        ),
        'const LISTED = [',
        ...names.map((name) => `  ['billing', ${name}],`),
        '];',
        '',
      ].join('\n'),
    );

    const files = [...sources.map((source) => counted(source, work)), counted(list, work, true)];
    const classes = new DeclaredClasses(CONFIG, files);
    const stores = readModelStoresOf(classes);
    const answers = new ListAnswers(readModelListOf(CONFIG, files.at(-1) ?? list), classes);

    expect(stores).toHaveLength(STORES);
    expect(stores.filter((store) => !answers.holds(store))).toEqual([]);
    expect(work.structures).toBe(files.length);
    expect(work.listScans).toBeLessThanOrEqual(2);
    // Read by a filter of every class for each class, the declarations alone were read 160 000 times.
    expect(work.shapes).toBeLessThan(STORES * 40);
  });
});
