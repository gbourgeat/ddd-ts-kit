import fs from 'node:fs';
import path from 'node:path';
import type { NextStep } from './next-step.js';
import type { TodoLocation } from './todo-location.js';
import { todosIn } from './todos-in.js';
import type { WorkspaceReport } from './workspace-report.js';

interface Pending {
  content: string;
  readonly existed: boolean;
}

/**
 * Every generator writes through this overlay, so a command either lands as a whole
 * plan or (with --dry-run) not at all, and later steps see the files of earlier ones.
 */
export class Workspace {
  readonly notes: string[] = [];

  private readonly pending = new Map<string, Pending>();

  private readonly skipped = new Set<string>();

  private readonly steps: NextStep[] = [];

  constructor(
    readonly root: string,
    private readonly force: boolean,
  ) {}

  exists(file: string): boolean {
    return this.pending.has(file) || fs.existsSync(this.absolute(file));
  }

  read(file: string): string | undefined {
    const pending = this.pending.get(file);

    if (pending !== undefined) return pending.content;

    try {
      return fs.readFileSync(this.absolute(file), 'utf8');
    } catch {
      return undefined;
    }
  }

  /** Names of the files directly inside `directory`, on disk or planned. */
  list(directory: string): string[] {
    const planned = [...this.pending.keys()].filter((file) => path.posix.dirname(file) === directory).map((file) => path.posix.basename(file));

    return [...new Set([...this.onDisk(directory, (entry) => entry.isFile()), ...planned])].sort();
  }

  /** Names of the directories directly inside `directory`, on disk or planned. */
  directories(directory: string): string[] {
    const prefix = `${directory}/`;

    const planned = [...this.pending.keys()].flatMap((file) => {
      const [child, ...rest] = file.startsWith(prefix) ? file.slice(prefix.length).split('/') : [];

      return child !== undefined && rest.length > 0 ? [child] : [];
    });

    return [...new Set([...this.onDisk(directory, (entry) => entry.isDirectory()), ...planned])].sort();
  }

  /** Never replaces a file the user may have edited, unless asked to with --force. */
  create(file: string, content: string): boolean {
    const onDisk = fs.existsSync(this.absolute(file));

    if ((onDisk || this.pending.has(file)) && !this.force) {
      if (onDisk) this.skipped.add(file);

      return false;
    }

    this.pending.set(file, { content, existed: onDisk });

    return true;
  }

  update(file: string, content: string): void {
    const pending = this.pending.get(file);

    if (pending !== undefined) {
      pending.content = content;

      return;
    }

    if (this.read(file) === content) return;

    this.pending.set(file, { content, existed: true });
  }

  note(message: string): void {
    if (!this.notes.includes(message)) this.notes.push(message);
  }

  /** Points the team at a line of a file this command changed, the way a `TODO(domain)` of a created file does. */
  step(step: NextStep): void {
    if (!this.steps.some((known) => known.file === step.file && known.text === step.text)) this.steps.push(step);
  }

  commit(dryRun: boolean): WorkspaceReport {
    const written = [...this.pending].map(([file, { content, existed }]) => ({ file, content, existed }));
    const left = written.filter(({ existed }) => !existed || this.force).flatMap(({ file, content }) => todosIn(file, content));
    const todos = [...left, ...this.steps.map((step) => this.located(step))];

    if (!dryRun) written.forEach(({ file, content }) => this.write(file, content));

    // The language comes before the code: its definition is the first thing to do.
    todos.sort((left, right) => Number(isLanguageStep(right)) - Number(isLanguageStep(left)));

    return {
      created: written.filter(({ existed }) => !existed).map(({ file }) => file),
      updated: written.filter(({ existed }) => existed).map(({ file }) => file),
      skipped: [...this.skipped].sort(),
      next: todos.map((todo) => `${todo.file}:${todo.line}`),
      todos,
      notes: this.notes,
    };
  }

  private located({ file, anchor, text }: NextStep): TodoLocation {
    const at = (this.read(file) ?? '').split('\n').findIndex((line) => line.includes(anchor));

    return { file, line: Math.max(at, 0) + 1, text };
  }

  private onDisk(directory: string, wanted: (entry: fs.Dirent) => boolean): string[] {
    try {
      return fs.readdirSync(this.absolute(directory), { withFileTypes: true }).filter(wanted).map((entry) => entry.name);
    } catch {
      // A directory that does not exist yet simply holds nothing on disk.
      return [];
    }
  }

  private write(file: string, content: string): void {
    fs.mkdirSync(path.dirname(this.absolute(file)), { recursive: true });
    fs.writeFileSync(this.absolute(file), content);
  }

  private absolute(file: string): string {
    return path.join(this.root, file);
  }
}

function isLanguageStep(todo: TodoLocation): boolean {
  return todo.text.startsWith('define the ubiquitous language first');
}
