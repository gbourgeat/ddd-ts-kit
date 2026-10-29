import type { Note } from './note';

/** The notes of the flags a line of the usage cannot explain, each under the command that takes it. */
export const FLAG_NOTES: readonly Note[] = [
  {
    name: '--commit-size',
    command: 'check',
    lines: [
      'the files and lines about to be committed against "commit" in the config (20 files and',
      '600 lines by default, generated files not counted); --staged reads the index only;',
      'advisory, --strict exits 1 when over',
    ],
  },
  {
    name: '--explain',
    command: 'check',
    lines: [
      'check follows the violations with the reason of each rule they report, once per rule, as',
      'explain gives it without its examples ("explanations" in JSON); with github and gitlab, each',
      'annotation carries the reason of its rule, a pull request showing an annotation on its own',
    ],
  },
  {
    name: '--behaviour',
    command: 'docs',
    lines: [
      'docs writes the pages of what the tests state (docs/behaviour/) alone, every other generated',
      'document left as it is: what the pre-commit hook runs when a spec is staged; with --check,',
      'those pages alone are compared',
    ],
  },
  {
    name: '--stored-events',
    command: 'docs',
    lines: [
      'docs records the shape of each version of the stored events in stored-events.lock.json,',
      'never rewriting a recorded one but one recorded by 0.82.0 or earlier, recorded again as',
      'the kit reads it now: run it once the shape of a version is the one to store; docs --check',
      'fails while a declared version is not recorded, or recorded by 0.82.0 or earlier, or',
      'recorded as the hash of nothing; the codecs of each module of a context are read too, and a',
      'codec whose data type is not found or declares no member is refused, nothing recorded',
    ],
  },
  {
    name: '--force',
    command: 'init',
    lines: [
      'init and generate replace the files that exist with what the kit writes, only while git',
      'holds them: a file to replace that differs from the last commit (uncommitted, staged,',
      'or untracked and not ignored) refuses the command, exit 2, the files named, nothing',
      'written; outside a git repository, every file whose content would change does; commit',
      'or stash first, then git diff shows what the kit rewrote; init --force keeps README.md,',
      'AGENTS.md, CLAUDE.md, the entry point and the pipeline definitions once written (listed',
      'as kept) and merges .gitignore and .dockerignore, the lines of the team kept',
    ],
  },
  {
    name: '--force',
    command: 'generate',
    lines: [
      'generate replaces the files that exist with what the kit writes, only while git holds',
      'them: a file to replace that differs from the last commit refuses the command, exit 2,',
      'the files named, nothing written; outside a git repository, every file whose content',
      'would change does; commit or stash first, then git diff shows what the kit rewrote',
    ],
  },
  {
    name: '--sdk',
    command: 'init',
    lines: ['init records "sdk" in the config and generates the clients with the project'],
  },
  {
    name: '--term',
    command: 'generate',
    lines: [
      'generate adds the row "<Term>=<meaning>" to the glossary of the CONTEXT.md before it judges',
      'a name; "<Term>=<meaning>|<not to be confused with>" fills the third cell too, a pipe being',
      'the one character a cell of the table cannot hold; taken by the kinds whose usage below',
      'shows it, refused by the others, as is any flag the usage of a kind does not show',
    ],
  },
  {
    name: '--reason',
    command: 'generate',
    lines: [
      'generate context writes it under ## Classification, the sentence of why the context is',
      'of its classification; generate adr --deviation records it as the reason of the deviation',
    ],
  },
  {
    name: '--local-only',
    command: 'generate',
    lines: [
      'generate refuses, and writes nothing, when the kind would write outside its context;',
      '"generate --help --json" says which kinds do',
    ],
  },
  {
    name: '--module',
    command: 'generate',
    lines: [
      'generate writes the files of the layers into that module of the model of the context',
      '(declared first with generate module), <module>/domain/ to <module>/presentation/, and',
      'their specs into test/unit/<module>/, finds the files it reads in the module that holds',
      'them and writes the imports to where they are; taken by the kinds whose usage below',
      'shows [--module <module>], and required by them in a context that declares modules',
      '(a file of a use case already in a module goes with it, and another module is',
      'refused); every other kind refuses it, what it writes staying at the level of the',
      'context (code list, permission set, database schema, route groups, guards, shared',
      'shapes, fakes, builders, worlds) or outside the contexts',
    ],
  },
];
