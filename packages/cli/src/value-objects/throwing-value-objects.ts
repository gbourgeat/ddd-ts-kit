import { CONFIG_FILE, editConfigText, type Config } from '../config/index.js';
import { isRecord } from '../config/values/is-record.js';
import type { MigrationDraft } from '../refusals/migration-draft.js';
import { projectSources } from '../refusals/project-sources.js';
import type { Workspace } from '../workspace/index.js';
import { leftovers } from './leftovers.js';
import type { ResultMethods } from './result-methods.js';
import { throwingSource } from './throwing-source.js';
import { rewriteUsages } from './rewrite-usages.js';

/** What moving the value objects of a project to throwing factories changed. */
export interface ValueObjectMigration {
  /** `Class.create` for a static factory, `Class#movedTo` for a method, of each one that returned a `Result`. */
  readonly converted: readonly string[];
  readonly throws: number;
  readonly unwraps: number;
  readonly assertions: number;
}

interface Tree {
  readonly ws: Workspace;
  readonly config: Config;
}

/**
 * Moves every value object of the project from a `Result` to a factory that returns the value or
 * throws, rewrites what reads them, and sets `"stack.valueObjects": "throwing"`. What it cannot
 * rewrite is said in `draft.manual`.
 */
export function throwingValueObjects(tree: Tree, draft: MigrationDraft): ValueObjectMigration {
  const sources = projectSources(tree.ws, tree.config);
  const { methods, classes, converted, throws } = convertValueObjects(sources, draft);
  let unwraps = 0;
  let assertions = 0;

  for (const file of sources) {
    const rewritten = rewriteUsages(draft.read(file) ?? '', methods);

    draft.write(file, rewritten.source);
    unwraps += rewritten.unwraps;
    assertions += rewritten.assertions;
    draft.manual.push(...leftovers(file, rewritten.source, classes));
  }

  draft.write(CONFIG_FILE, editConfigText(draft.read(CONFIG_FILE) ?? '{}', sayThrowing));

  return { converted, throws, unwraps, assertions };
}

interface Converted {
  readonly methods: ResultMethods;
  readonly converted: readonly string[];
  readonly classes: ReadonlySet<string>;
  readonly throws: number;
}

function convertValueObjects(sources: readonly string[], draft: MigrationDraft): Converted {
  const statics = new Set<string>();
  const instance = new Set<string>();
  const classes = new Set<string>();
  const converted: string[] = [];
  let throws = 0;

  for (const file of sources.filter((candidate) => (draft.read(candidate) ?? '').includes('extends ValueObject'))) {
    const thrown = throwingSource(draft.read(file) ?? '');
    const className = thrown.className ?? '';

    draft.write(file, thrown.source);
    thrown.statics.forEach((name) => statics.add(name));
    thrown.instance.forEach((name) => instance.add(name));
    converted.push(...thrown.statics, ...thrown.instance.map((name) => `${className}#${name}`));
    classes.add(thrown.statics.length + thrown.instance.length > 0 ? className : '');
    throws += thrown.throws;
  }

  return { methods: { statics, instance }, classes, converted, throws };
}

function sayThrowing(raw: Record<string, unknown>): void {
  raw['stack'] = { ...(isRecord(raw['stack']) ? raw['stack'] : {}), valueObjects: 'throwing' };
}
