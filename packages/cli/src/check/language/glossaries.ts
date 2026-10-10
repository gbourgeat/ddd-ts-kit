import fs from 'node:fs';
import path from 'node:path';
import { parseGlossary, type Glossary } from './parse-glossary.js';

/** The glossary of each context, read once, and the contexts already reported as having none. */
export class Glossaries {
  private readonly read = new Map<string, Glossary>();
  private readonly reportedEmpty = new Set<string>();

  constructor(
    private readonly root: string,
    private readonly contextsDir: string,
  ) {}

  docOf(context: string): string {
    return `${this.contextsDir}/${context}/CONTEXT.md`;
  }

  of(context: string): Glossary {
    const known = this.read.get(context);

    if (known !== undefined) {
      return known;
    }

    const glossary = parseGlossary(this.text(context));

    this.read.set(context, glossary);

    return glossary;
  }

  /** True the first time only: an empty glossary is one finding, not one per class. */
  reportsEmptyOnce(context: string): boolean {
    if (this.reportedEmpty.has(context)) {
      return false;
    }

    this.reportedEmpty.add(context);

    return true;
  }

  private text(context: string): string {
    try {
      return fs.readFileSync(path.join(this.root, this.docOf(context)), 'utf8');
    } catch {
      // A missing CONTEXT.md is reported by tree/context-doc; here it is an empty glossary.
      return '';
    }
  }
}
