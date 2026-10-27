import fs from 'node:fs';
import path from 'node:path';
import { parseGlossary, type Glossary } from './parse-glossary';

/**
 * The glossary of each context, and of the shared kernel, read once, and the documents already
 * reported as holding none. A glossary is known by the path of its CONTEXT.md.
 */
export class Glossaries {
  private readonly read = new Map<string, Glossary>();
  private readonly texts = new Map<string, string>();
  private readonly reportedEmpty = new Set<string>();

  constructor(
    private readonly root: string,
    private readonly contextsDir: string,
  ) {}

  docOf(context: string): string {
    return `${this.contextsDir}/${context}/CONTEXT.md`;
  }

  of(context: string): Glossary {
    return this.at(this.docOf(context));
  }

  /** The CONTEXT.md of a context as it is written, read once; empty when it is missing. */
  textOf(context: string): string {
    return this.textAt(this.docOf(context));
  }

  /** The glossary a CONTEXT.md holds, by its path from the project root. */
  at(doc: string): Glossary {
    const known = this.read.get(doc);

    if (known !== undefined) {
      return known;
    }

    const glossary = parseGlossary(this.textAt(doc));

    this.read.set(doc, glossary);

    return glossary;
  }

  /** True the first time only: an empty glossary is one finding, not one per class. */
  reportsEmptyOnce(doc: string): boolean {
    if (this.reportedEmpty.has(doc)) {
      return false;
    }

    this.reportedEmpty.add(doc);

    return true;
  }

  private textAt(doc: string): string {
    const known = this.texts.get(doc);

    if (known !== undefined) {
      return known;
    }

    const text = this.readDoc(doc);

    this.texts.set(doc, text);

    return text;
  }

  private readDoc(doc: string): string {
    try {
      return fs.readFileSync(path.join(this.root, doc), 'utf8');
    } catch {
      // A missing CONTEXT.md of a context is reported by tree/context-doc; here it is an empty glossary.
      return '';
    }
  }
}
