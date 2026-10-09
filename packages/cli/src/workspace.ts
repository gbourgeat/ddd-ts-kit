import fs from 'node:fs';
import path from 'node:path';

interface TodoLocation {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

export interface WorkspaceReport {
  readonly created: string[];
  readonly updated: string[];
  readonly skipped: string[];
  readonly next: string[];
  readonly todos: TodoLocation[];
  readonly notes: string[];
}

const TODO_MARK = 'TODO(domain):';

/**
 * Every generator writes through this overlay, so a command either lands as a whole
 * plan or (with --dry-run) not at all, and later steps see the files of earlier ones.
 */
export class Workspace {
  readonly #pending = new Map<string, { content: string; existed: boolean }>();
  readonly #skipped = new Set<string>();
  readonly notes: string[] = [];

  constructor(
    readonly root: string,
    private readonly force: boolean,
  ) {}

  exists(file: string): boolean {
    return this.#pending.has(file) || fs.existsSync(this.#absolute(file));
  }

  read(file: string): string | undefined {
    const pending = this.#pending.get(file);
    if (pending !== undefined) return pending.content;
    try {
      return fs.readFileSync(this.#absolute(file), 'utf8');
    } catch {
      return undefined;
    }
  }

  /** Names of the files directly inside `directory`, on disk or planned. */
  list(directory: string): string[] {
    const names = new Set<string>();
    try {
      for (const entry of fs.readdirSync(this.#absolute(directory), { withFileTypes: true })) {
        if (entry.isFile()) names.add(entry.name);
      }
    } catch {
      // A directory that does not exist yet simply has no file on disk.
    }
    for (const file of this.#pending.keys()) {
      if (path.posix.dirname(file) === directory) names.add(path.posix.basename(file));
    }
    return [...names].sort();
  }

  /** Names of the directories directly inside `directory`, on disk or planned. */
  directories(directory: string): string[] {
    const names = new Set<string>();
    try {
      for (const entry of fs.readdirSync(this.#absolute(directory), { withFileTypes: true })) {
        if (entry.isDirectory()) names.add(entry.name);
      }
    } catch {
      // A directory that does not exist yet simply has no child on disk.
    }
    const prefix = `${directory}/`;
    for (const file of this.#pending.keys()) {
      const [child, ...rest] = file.startsWith(prefix) ? file.slice(prefix.length).split('/') : [];
      if (child !== undefined && rest.length > 0) names.add(child);
    }
    return [...names].sort();
  }

  /** Never replaces a file the user may have edited, unless asked to with --force. */
  create(file: string, content: string): boolean {
    const onDisk = fs.existsSync(this.#absolute(file));
    if ((onDisk || this.#pending.has(file)) && !this.force) {
      if (onDisk) this.#skipped.add(file);
      return false;
    }
    this.#pending.set(file, { content, existed: onDisk });
    return true;
  }

  update(file: string, content: string): void {
    const pending = this.#pending.get(file);
    if (pending !== undefined) {
      pending.content = content;
      return;
    }
    if (this.read(file) === content) return;
    this.#pending.set(file, { content, existed: true });
  }

  note(message: string): void {
    if (!this.notes.includes(message)) this.notes.push(message);
  }

  commit(dryRun: boolean): WorkspaceReport {
    const report: WorkspaceReport = {
      created: [],
      updated: [],
      skipped: [...this.#skipped].sort(),
      next: [],
      todos: [],
      notes: this.notes,
    };
    for (const [file, { content, existed }] of this.#pending) {
      (existed ? report.updated : report.created).push(file);
      if (!existed || this.force) collectTodos(file, content, report);
      if (dryRun) continue;
      fs.mkdirSync(path.dirname(this.#absolute(file)), { recursive: true });
      fs.writeFileSync(this.#absolute(file), content);
    }
    // The language comes before the code: its definition is the first thing to do.
    report.todos.sort((a, b) => Number(isLanguageStep(b)) - Number(isLanguageStep(a)));
    report.next.splice(0, report.next.length, ...report.todos.map((todo) => `${todo.file}:${todo.line}`));
    return report;
  }

  #absolute(file: string): string {
    return path.join(this.root, file);
  }
}

const isLanguageStep = (todo: TodoLocation): boolean => todo.text.startsWith('define the ubiquitous language first');

function collectTodos(file: string, content: string, report: WorkspaceReport): void {
  content.split('\n').forEach((line, index) => {
    const at = line.indexOf(TODO_MARK);
    if (at === -1) return;
    report.next.push(`${file}:${index + 1}`);
    report.todos.push({ file, line: index + 1, text: cleanTodo(line.slice(at + TODO_MARK.length)) });
  });
}

function cleanTodo(text: string): string {
  return text.replace(/['"`]?\)?;?\s*$/, '').trim();
}
