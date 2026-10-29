import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE } from '../config';
import { inDialect } from '../package-manager/in-dialect';
import { packageManagerOf } from '../package-manager/package-manager-of';
import type { NextStep } from './next-step';
import type { TodoLocation } from './todo-location';
import { todosIn } from './todos-in';
import { isLanguageStep } from './is-language-step';
import { isFileOrAbsent } from './is-file-or-absent';
import { namesOnDisk } from './names-on-disk';
import { pruneEmptied } from './prune-emptied';
import { refuseLeaving } from './refuse-leaving';
import { refuseUnheld } from './refuse-unheld';
import { writtenOf } from './written-of';
import type { WorkspaceReport } from './workspace-report';

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

  /** Files the team owns once written, which --force leaves as they are: reported as kept. */
  private readonly kept = new Set<string>();

  /** Files where a device stands, such as a path the sandbox of an agent masks: reported unwritable. */
  private readonly masked = new Set<string>();

  /** Files on disk --force replaces, or whose values of the team it writes over: git must hold them. */
  private readonly replaced = new Set<string>();

  /** Files on disk this command removes: no longer derived from anything. */
  private readonly removed = new Set<string>();

  private readonly steps: NextStep[] = [];

  private readonly rewrites: ((file: string, text: string) => string)[] = [];

  private placement: ((file: string, writing: boolean) => string) | undefined;

  private pruning = false;

  constructor(
    readonly root: string,
    private readonly force: boolean,
  ) {}

  exists(asked: string): boolean {
    const file = this.placed(asked);

    return this.pending.has(file) || (!this.removed.has(file) && fs.existsSync(this.absolute(file)));
  }

  /** True when a file or a directory is at this very path, on disk or planned, wherever `placeFiles` would take it. */
  existsAsIs(file: string): boolean {
    return (
      this.pending.has(file) ||
      [...this.pending.keys()].some((planned) => planned.startsWith(`${file}/`)) ||
      (!this.removed.has(file) && fs.existsSync(this.absolute(file)))
    );
  }

  read(asked: string): string | undefined {
    const file = this.placed(asked);
    const pending = this.pending.get(file);

    if (pending !== undefined) {
      return pending.content;
    }

    if (this.removed.has(file) || !isFileOrAbsent(this.absolute(file))) {
      // A device in place of a file (what a sandbox mounts over a path it protects) holds no text of the project.
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

    const onDisk = namesOnDisk(this.absolute(directory), (entry) => entry.isFile()).filter(
      (name) => !this.removed.has(`${directory}/${name}`),
    );

    return [...new Set([...onDisk, ...planned])].sort();
  }

  /**
   * Names of the directories directly inside `directory`, on disk or planned. A name that starts
   * with a dot is a tool's folder (the Claude Code sandbox leaves `.claude/.cc-writes` where a
   * command wrote), never a context, a module nor a source folder: it is left out.
   */
  directories(directory: string): string[] {
    const prefix = `${directory}/`;

    const planned = [...this.pending.keys()].flatMap((file) => {
      const [child, ...rest] = file.startsWith(prefix) ? file.slice(prefix.length).split('/') : [];

      return child !== undefined && rest.length > 0 ? [child] : [];
    });

    return [...new Set([...namesOnDisk(this.absolute(directory), (entry) => entry.isDirectory()), ...planned])]
      .filter((name) => !name.startsWith('.'))
      .sort();
  }

  /** True when this command already wrote the file, whether it is on disk or not. */
  planned(file: string): boolean {
    return this.pending.has(this.placed(file));
  }

  /** Never replaces a file the user may have edited, unless asked to with --force. */
  create(asked: string, content: string): boolean {
    const file = this.placed(asked, true);
    const onDisk = fs.existsSync(this.absolute(file));

    if (this.exists(file) && !this.force) {
      if (onDisk) {
        (isFileOrAbsent(this.absolute(file)) ? this.skipped : this.masked).add(file);
      }

      return false;
    }

    if (onDisk && this.force) {
      this.replaced.add(file);
    }

    this.removed.delete(file);
    this.pending.set(file, { content: this.spoken(this.withImports(file, content)), existed: onDisk });

    return true;
  }

  /** Leaves a file that exists as it is, even with --force: it is the team's once written. */
  keep(asked: string): void {
    this.kept.add(this.placed(asked));
  }

  /** A merge --force asked for writes over a value of the team in this file: git must hold it, as a file --force replaces. */
  replacing(asked: string): void {
    this.replaced.add(this.placed(asked));
  }

  update(asked: string, written: string): void {
    const file = this.placed(asked, true);
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

    // A file not on disk yet is created, a derived one included.
    this.pending.set(file, { content, existed: fs.existsSync(this.absolute(file)) });
  }

  /**
   * Writes a file as it is, no dialect of the package manager and no import rewrite applied:
   * what a move carries from one place to another, which must lose nothing of the text.
   */
  writeAsIs(asked: string, content: string): void {
    const file = this.placed(asked, true);
    const pending = this.pending.get(file);

    if (pending !== undefined) {
      pending.content = content;

      return;
    }

    this.removed.delete(file);

    const existed = fs.existsSync(this.absolute(file));

    if (!(existed && this.read(file) === content)) {
      this.pending.set(file, { content, existed });
    }
  }

  /**
   * Removes a file a command derives and that is no longer derived from anything, such as the
   * generated declarations of a folder that holds no declared class any more. A file only
   * planned is forgotten; one on disk is deleted at the commit, and reported.
   */
  delete(asked: string): void {
    const file = this.placed(asked);

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
    this.rewrites.push(rewrite);
  }

  /** A text with its imports as `rewriteImports` names them: a block compared with the imports of its file before it joins them. */
  withImports(file: string, text: string): string {
    return /\.(?:ts|tsx|mts|js|mjs)$/.test(file)
      ? this.rewrites.reduce((written, rewrite) => rewrite(file, written), text)
      : text;
  }

  /**
   * While set, every path this command reads or writes goes through `place`: a generator names the
   * files of a context as they are without modules of its model, and the workspace finds them in
   * the module that holds them, or writes them in the module the command was given. Unset with
   * `undefined` before what derives the generated files from the tree.
   */
  placeFiles(place: ((file: string, writing: boolean) => string) | undefined): void {
    this.placement = place;
  }

  /** A command that moves files asks for it: a folder a removed file leaves empty goes too, then its emptied parents. */
  pruneEmptiedFolders(): void {
    this.pruning = true;
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
  step(asked: NextStep): void {
    // Recorded where the file is, in its module of the model when the command writes in one.
    const step = { ...asked, file: this.placed(asked.file) };

    if (!this.steps.some((known) => known.file === step.file && known.text === step.text)) {
      this.steps.push(step);
    }
  }

  /**
   * Writes the plan, or (dry run) only says it. A file it cannot write here (a path the sandbox of an
   * agent protects) is reported as unwritable, in `skipped` too, and every other file is written;
   * then no file is deleted, so that a move loses nothing. A path that leads out of the project,
   * or a file --force would replace that git does not hold, refuses the whole plan first.
   */
  commit(dryRun: boolean): WorkspaceReport {
    refuseLeaving(this.root, [...new Set([...this.pending.keys(), ...this.removed])].sort(), (file) =>
      this.absolute(file),
    );

    refuseUnheld(this.root, this.replaced, this.pending);

    const unwritten: string[] = [];
    const planned = [...this.pending].map(([file, { content, existed }]) => ({ file, content, existed }));
    const written = writtenOf(planned, { dryRun, absolute: (file) => this.absolute(file) }, unwritten);
    const unwritable = [...new Set([...this.masked, ...unwritten])].sort();
    const deleted = unwritable.length === 0 ? [...this.removed].sort() : [];

    const left = written
      .filter(({ existed }) => !existed || this.force)
      .flatMap(({ file, content }) => todosIn(file, content));

    const todos = [...left, ...this.steps.map((step) => this.located(step))];

    if (!dryRun) {
      deleted.forEach((file) => this.remove(file));
    }

    // The language comes before the code: its definition is the first thing to do.
    todos.sort((left, right) => Number(isLanguageStep(right)) - Number(isLanguageStep(left)));

    return {
      created: written.filter(({ existed }) => !existed).map(({ file }) => file),
      updated: written.filter(({ existed }) => existed).map(({ file }) => file),
      deleted,
      skipped: [...new Set([...this.skipped, ...unwritable])].sort(),
      kept: [...this.kept].sort(),
      unwritable,
      next: todos.map((todo) => `${todo.file}:${todo.line}`),
      todos,
      notes: this.notes.map((note) => this.spoken(note)),
    };
  }

  private remove(file: string): void {
    fs.rmSync(this.absolute(file), { force: true });

    if (this.pruning) {
      pruneEmptied(this.root, path.posix.dirname(file));
    }
  }

  private located({ file, anchor, text }: NextStep): TodoLocation {
    const at = (this.read(file) ?? '').split('\n').findIndex((line) => line.includes(anchor));

    return { file, line: Math.max(at, 0) + 1, text };
  }

  private absolute(file: string): string {
    return path.join(this.root, file);
  }

  private placed(file: string, writing = false): string {
    return this.placement === undefined ? file : this.placement(file, writing);
  }
}
