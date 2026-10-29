import {
  ciExtraProblems,
  openApiProblems,
  sdkProblems,
  CLASSIFICATIONS,
  commitLimitProblems,
  CONFIG_FILE,
  FUNCTION_LINES_CEILING,
  AGENT_PROFILES,
  GUARD_MODES,
  WORKTREE_MODES,
  IMPORT_EXTENSIONS,
  isOneOf,
  RELATIONSHIPS,
  SEVERITIES,
  type ContextConfig,
  type Upstream,
} from '../../config';
import type { Project } from '../model/project';
import type { Report } from '../model/report';
import type { Violation } from '../model/violation';
import { isRecord } from '../support/is-record';
import { lineOf } from '../support/line-of';
import { lineOfSequence } from '../support/line-of-sequence';
import { contextTenancy } from './context-tenancy';
import { leavingDirectories } from './leaving-directories';
import { measureSettings } from './measure-settings';
import { moduleProblems } from './module-problems';
import { rawConfig } from './raw-config';

/** What `config/valid` looks at in one project, each finding placed on a line of the config file. */
export class ConfigInspection {
  constructor(
    private readonly project: Project,
    private readonly report: Report,
  ) {}

  declaredContext(name: string, context: ContextConfig): Violation[] {
    return [
      ...this.classification(name, context),
      ...contextTenancy(name, context, this.project.configText).map(({ line, message, fix }) =>
        this.report({ file: CONFIG_FILE, line }, message, fix),
      ),
      ...context.upstreams.flatMap((upstream) => this.upstream(name, upstream)),
      ...this.presence(name, context),
      ...moduleProblems(name, context, this.writtenModules(name)).map(({ needle, message, fix }) =>
        this.report({ file: CONFIG_FILE, line: this.moduleLine(name, needle) }, message, fix),
      ),
    ];
  }

  undeclaredDirectories(): Violation[] {
    const { contextsDir, contexts } = this.project.config;
    const fix = `Declare it under "contexts" in ${CONFIG_FILE} with its classification and upstreams.`;

    return this.project.contextsOnDisk
      .filter((name) => contexts[name] === undefined)
      .map((name) =>
        this.report(
          { file: `${contextsDir}/${name}`, line: 1 },
          `The directory ${contextsDir}/${name} is not a declared context.`,
          fix,
        ),
      );
  }

  ruleSettings(known: readonly string[]): Violation[] {
    return Object.entries(this.project.config.rules).flatMap(([id, setting]) => {
      if (!known.includes(id)) {
        return [
          this.inConfig(id, `The rule "${id}" does not exist.`, 'Fix the id; `ddd-ts-kit rules` lists the valid ones.'),
        ];
      }

      const severity = typeof setting === 'string' ? setting : setting.severity;

      if (!isOneOf(SEVERITIES, severity)) {
        return [
          this.inConfig(
            id,
            `The rule "${id}" has the severity "${severity}".`,
            `Use one of: ${SEVERITIES.join(', ')}.`,
          ),
        ];
      }

      if (typeof setting !== 'string' && setting.files.length === 0) {
        return [
          this.inConfig(
            id,
            `The rule "${id}" is set for some files, but "files" names none.`,
            'List the files it is for in "files", as globs relative to the project root (`src/contexts/*/*.declarations.ts`), or write the severity alone for the whole project.',
          ),
        ];
      }

      return [];
    });
  }

  guardMode(): Violation[] {
    const { guard } = this.project.config;

    if (isOneOf(GUARD_MODES, guard)) {
      return [];
    }

    return [
      this.inConfig(
        'guard',
        `"guard" is "${guard}".`,
        `Use one of: ${GUARD_MODES.join(', ')} (how the editor hook reacts to a violation: refuse the write, only report it, or stay silent).`,
      ),
    ];
  }

  worktreeMode(): Violation[] {
    const { worktrees } = this.project.config;

    return isOneOf(WORKTREE_MODES, worktrees)
      ? []
      : [
          this.inConfig(
            'worktrees',
            `"worktrees" is "${worktrees}".`,
            `Use one of: ${WORKTREE_MODES.join(', ')} (whether the guard refuses the code of a context in the main checkout of the trunk, or only says to open a worktree).`,
          ),
        ];
  }

  /** `none` is never written: a config with the key names the profile `init` wrote. */
  agentProfile(): Violation[] {
    const { profile } = this.project.config.agents;

    return profile === undefined || (profile !== 'none' && isOneOf(AGENT_PROFILES, profile))
      ? []
      : [
          this.inConfig(
            'agents',
            `"agents.profile" is "${profile}".`,
            'Use "regulated" (the sandbox and the hooks of a regulated organisation, `init --agent-profile regulated`), or remove the key (`init --agent-profile none`).',
          ),
        ];
  }

  /** A directory the generators write in that leads out of the project: every command that writes refuses the config. */
  projectDirectories(): Violation[] {
    return leavingDirectories(rawConfig(this.project)).map(({ key, message, fix }) => this.inConfig(key, message, fix));
  }

  /** Another value is read as `js`: the config says something no tool does. */
  importExtension(): Violation[] {
    const { importExtension } = this.project.config;

    if (isOneOf(IMPORT_EXTENSIONS, importExtension)) {
      return [];
    }

    return [
      this.inConfig(
        'importExtension',
        `"importExtension" is "${importExtension}".`,
        `Use one of: ${IMPORT_EXTENSIONS.join(', ')} (whether an import of a file of the project is written without an extension, or with the ".js" of the file the compiler emits; a config without the key is read as "js").`,
      ),
    ];
  }

  /** A limit above the ceiling is read as the ceiling: the config says something the checker does not do. */
  functionLinesLimit(): Violation[] {
    const limits = rawConfig(this.project)['limits'];
    const written = isRecord(limits) ? limits['maxFunctionLines'] : undefined;

    if (typeof written !== 'number' || written <= FUNCTION_LINES_CEILING) {
      return [];
    }

    const fix = `Set "limits.maxFunctionLines" to ${FUNCTION_LINES_CEILING} or less: no function is longer than ${FUNCTION_LINES_CEILING} lines, whatever the config says.`;

    return [
      this.inConfig(
        'maxFunctionLines',
        `"limits.maxFunctionLines" is ${written}, above the ceiling of ${FUNCTION_LINES_CEILING}: it is read as ${FUNCTION_LINES_CEILING}.`,
        fix,
      ),
    ];
  }

  /** A commit limit that is not a positive integer is read as its default: the config says something nothing does. */
  commitLimits(): Violation[] {
    return commitLimitProblems(rawConfig(this.project)['commit']).map(({ key, message, fix }) =>
      this.inConfig(key, message, fix),
    );
  }

  /** An extra job the pipeline does not know is written by no `init`: the config says something no pipeline runs. */
  ciExtras(): Violation[] {
    return ciExtraProblems(rawConfig(this.project)['ci']).map(({ key, message, fix }) =>
      this.inConfig(key, message, fix),
    );
  }

  /** A format or a document the scripts cannot write as the config says. */
  openApiSettings(): Violation[] {
    const contexts = Object.keys(this.project.config.contexts);

    return openApiProblems(rawConfig(this.project)['openapi'], contexts).map(({ key, message, fix }) =>
      this.inConfig(key, message, fix),
    );
  }

  /** A client the config asks for that npm would not publish as it says. */
  sdkSettings(): Violation[] {
    return sdkProblems(rawConfig(this.project)['sdk']).map(({ key, message, fix }) => this.inConfig(key, message, fix));
  }

  /** A coverage threshold, a mutation floor or a time budget the config writes that no run reads as written. */
  measureSettings(): Violation[] {
    return measureSettings(this.project, this.report);
  }

  /** An entry without a file or without a reason allows nothing: it is ignored, and has to be said. */
  onePerFileAllowances(): Violation[] {
    const onePerFile = rawConfig(this.project)['onePerFile'];
    const entries: unknown[] = isRecord(onePerFile) && Array.isArray(onePerFile['allow']) ? onePerFile['allow'] : [];

    const fix =
      'Write each entry as { "file": "<path or glob from the project root>", "reason": "<why these exports are one thing>" }, or remove it.';

    return entries.flatMap((entry, index) => {
      const missing = missingOf(entry);

      if (missing === undefined) {
        return [];
      }

      const line = lineOfSequence(this.project.configText, [
        '"onePerFile"',
        '"allow"',
        ...Array.from({ length: index + 1 }, () => '{'),
      ]);

      return [
        this.report(
          { file: CONFIG_FILE, line },
          `Entry ${index + 1} of "onePerFile.allow" has no ${missing}: it is ignored.`,
          fix,
        ),
      ];
    });
  }

  private classification(name: string, context: ContextConfig): Violation[] {
    if (isOneOf(CLASSIFICATIONS, context.classification)) {
      return [];
    }

    return [
      this.inConfig(
        name,
        `The context "${name}" has the classification "${context.classification}".`,
        `Set contexts.${name}.classification to one of: ${CLASSIFICATIONS.join(', ')}.`,
      ),
    ];
  }

  private upstream(name: string, upstream: Upstream): Violation[] {
    const violations: Violation[] = [];

    if (upstream.context === name) {
      violations.push(
        this.inConfig(
          name,
          `The context "${name}" lists itself as an upstream.`,
          'Remove the entry: a context does not depend on itself.',
        ),
      );
    } else if (this.project.config.contexts[upstream.context] === undefined) {
      const create = `\`ddd-ts-kit generate context ${upstream.context} --classification <core|supporting|generic>\``;

      violations.push(
        this.inConfig(
          upstream.context,
          `The context "${name}" declares the unknown upstream "${upstream.context}".`,
          `Fix the name, or create the context with ${create}.`,
        ),
      );
    }

    if (!isOneOf(RELATIONSHIPS, upstream.relationship)) {
      const message = `The relationship "${upstream.relationship}" between "${name}" and "${upstream.context}" is unknown.`;

      violations.push(this.inConfig(upstream.relationship, message, `Use one of: ${RELATIONSHIPS.join(', ')}.`));
    }

    return violations;
  }

  private presence(name: string, context: ContextConfig): Violation[] {
    if (this.project.contextsOnDisk.includes(name)) {
      return [];
    }

    const { contextsDir } = this.project.config;
    const create = `\`ddd-ts-kit generate context ${name} --classification ${context.classification || 'core'}\``;

    return [
      this.inConfig(
        name,
        `The context "${name}" is declared but ${contextsDir}/${name} does not exist.`,
        `Create it with ${create}, or remove it from the config.`,
      ),
    ];
  }

  /** `contexts.<name>.modules` as the file holds it, before parsing drops what it cannot read. */
  private writtenModules(name: string): unknown {
    const contexts = rawConfig(this.project)['contexts'];
    const context = isRecord(contexts) ? contexts[name] : undefined;

    return isRecord(context) ? context['modules'] : undefined;
  }

  /** The line of the entry of a module of a context: the context, then its modules, then `needle`. */
  private moduleLine(context: string, needle: string): number {
    return lineOfSequence(this.project.configText, ['"contexts"', `"${context}"`, '"modules"', `"${needle}"`]);
  }

  /** A violation located on the line of the config file that first quotes `needle`. */
  private inConfig(needle: string, message: string, fix: string): Violation {
    return this.report({ file: CONFIG_FILE, line: lineOf(this.project.configText, `"${needle}"`) }, message, fix);
  }
}

function missingOf(entry: unknown): string | undefined {
  const record = isRecord(entry) ? entry : {};

  const has = (key: string): boolean => {
    const value = record[key];

    return typeof value === 'string' && value.trim() !== '';
  };

  if (!has('file')) {
    return has('reason') ? 'file' : 'file and no reason';
  }

  return has('reason') ? undefined : 'reason';
}
