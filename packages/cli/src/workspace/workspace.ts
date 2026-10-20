import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE } from '../config/index.js';
import { inDialect } from '../package-manager/in-dialect.js';
import { packageManagerOf } from '../package-manager/package-manager-of.js';
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
 * What it writes and notes is said in the dialect of the package manager the config
 * file of the project names: the templates are written for npm.
 */
export class Workspace {
  readonly notes: string[] = [];

  private readonly pending = new Map<string, Pending>();

  private readonly skipped = new Set<string>();

  /** Files on disk this command removes: no longer derived from anything. */
  private readonly removed = new Set<string>();

  private readonly steps: NextStep[] = [];

  private rewrite: ((file: string, text: string) => string) | undefined;

  constructor(
    readonly root: string,
    private readonly force: boolean,
  ) {}

  exists(file: string): boolean {
    return this.pending.has(file) || (!this.removed.has(file) && fs.existsSync(this.absolute(file)));
  }

  read(file: string): string | undefined {
    const pending = this.pending.get(file);

    if (pending !== undefined) {
      return pending.content;
    }

    if (this.removed.has(file)) {
      return undefined;
    }

    try {
      return fs.readFileSync(this.absolute(file), 'utf8');
    } catch {
      return undefined;
    }
  }

  /** Names of the files directly inside `directory`, on disk or planned. */
  list(directory: string): string[] {
    const planned = [...this.pending.keys()]
      .filter((file) => path.posix.dirname(file) === directory)
      .map((file) => path.posix.basename(file));

    const onDisk = this.onDisk(directory, (entry) => entry.isFile()).filter(
      (name) => !this.removed.has(`${directory}/${name}`),
    );

    return [...new Set([...onDisk, ...planned])].sort();
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

  /** True when this command already wrote the file, whether it is on disk or not. */
  planned(file: string): boolean {
    return this.pending.has(file);
  }

  /** Never replaces a file the user may have edited, unless asked to with --force. */
  create(file: string, content: string): boolean {
    const onDisk = fs.existsSync(this.absolute(file));

    if (this.exists(file) && !this.force) {
      if (onDisk) {
        this.skipped.add(file);
      }

      return false;
    }

    this.removed.delete(file);
    this.pending.set(file, { content: this.spoken(this.withImports(file, content)), existed: onDisk });

    return true;
  }

  update(file: string, written: string): void {
    const content = this.spoken(this.withImports(file, written));
    const pending = this.pending.get(file);

    if (pending !== undefined) {
      pending.content = content;

      return;
    }

    this.removed.delete(file);

    if (this.read(file) === content) {
      return;
    }

    this.pending.set(file, { content, existed: true });
  }

  /**
   * Removes a file a command derives and that is no longer derived from anything, such as the
   * generated declarations of a folder that holds no declared class any more. A file only
   * planned is forgotten; one on disk is deleted at the commit, and reported.
   */
  delete(file: string): void {
    this.pending.delete(file);

    if (fs.existsSync(this.absolute(file))) {
      this.removed.add(file);
    }
  }

  /**
   * Every module this command writes names the files of the project through `rewrite`: a project
   * that keeps its platform flat is written imports of the flat files.
   */
  rewriteImports(rewrite: (file: string, text: string) => string): void {
    this.rewrite = rewrite;
  }

  /** A text written for npm, as the package manager of the project says it: what is compared with a file is compared in its dialect. */
  spoken(text: string): string {
    return inDialect(text, packageManagerOf(this.read(CONFIG_FILE)));
  }

  note(message: string): void {
    if (!this.notes.includes(message)) {
      this.notes.push(message);
    }
  }

  /** Points the team at a line of a file this command changed, the way a `TODO(domain)` of a created file does. */
  step(step: NextStep): void {
    if (!this.steps.some((known) => known.file === step.file && known.text === step.text)) {
      this.steps.push(step);
    }
  }

  commit(dryRun: boolean): WorkspaceReport {
    const written = [...this.pending].map(([file, { content, existed }]) => ({ file, content, existed }));

    const left = written
      .filter(({ existed }) => !existed || this.force)
      .flatMap(({ file, content }) => todosIn(file, content));

    const todos = [...left, ...this.steps.map((step) => this.located(step))];

    if (!dryRun) {
      written.forEach(({ file, content }) => this.write(file, content));
      this.removed.forEach((file) => fs.rmSync(this.absolute(file), { force: true }));
    }

    // The language comes before the code: its definition is the first thing to do.
    todos.sort((left, right) => Number(isLanguageStep(right)) - Number(isLanguageStep(left)));

    return {
      created: written.filter(({ existed }) => !existed).map(({ file }) => file),
      updated: written.filter(({ existed }) => existed).map(({ file }) => file),
      deleted: [...this.removed].sort(),
      skipped: [...this.skipped].sort(),
      next: todos.map((todo) => `${todo.file}:${todo.line}`),
      todos,
      notes: this.notes.map((note) => this.spoken(note)),
    };
  }

  private located({ file, anchor, text }: NextStep): TodoLocation {
    const at = (this.read(file) ?? '').split('\n').findIndex((line) => line.includes(anchor));

    return { file, line: Math.max(at, 0) + 1, text };
  }

  private onDisk(directory: string, wanted: (entry: fs.Dirent) => boolean): string[] {
    try {
      return fs
        .readdirSync(this.absolute(directory), { withFileTypes: true })
        .filter(wanted)
        .map((entry) => entry.name);
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

  private withImports(file: string, text: string): string {
    return this.rewrite !== undefined && /\.(?:ts|tsx|mts|js|mjs)$/.test(file) ? this.rewrite(file, text) : text;
  }
}

function isLanguageStep(todo: TodoLocation): boolean {
  return todo.text.startsWith('define the ubiquitous language first');
}
