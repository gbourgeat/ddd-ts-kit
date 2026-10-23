import fs from 'node:fs';
import path from 'node:path';
import type { Workspace } from '../workspace';

/** The files a migration writes and removes, kept in memory until it is committed: a dry run commits nothing. */
export class MigrationDraft {
  readonly manual: string[] = [];

  private readonly files = new Map<string, string | undefined>();

  constructor(private readonly ws: Workspace) {}

  read(file: string): string | undefined {
    return this.files.has(file) ? this.files.get(file) : this.ws.read(file);
  }

  write(file: string, content: string): void {
    if (this.read(file) !== content) {
      this.files.set(file, content);
    }
  }

  remove(file: string): void {
    this.files.set(file, undefined);
  }

  get written(): string[] {
    return [...this.files].filter(([, content]) => content !== undefined).map(([file]) => file);
  }

  get removed(): string[] {
    return [...this.files].filter(([, content]) => content === undefined).map(([file]) => file);
  }

  commit(): void {
    for (const [file, content] of this.files) {
      const target = path.join(this.ws.root, file);

      if (content === undefined) {
        fs.rmSync(target, { force: true });
      } else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
      }
    }
  }
}
