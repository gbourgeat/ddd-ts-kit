import { CLASSIFICATIONS, CONFIG_FILE, GUARD_MODES, isOneOf, RELATIONSHIPS, SEVERITIES, type ContextConfig } from '../../config.js';
import type { Project, Rule, Violation } from '../types.js';
import { lineOf, reporter, type Report } from './helpers.js';

export function createConfigValid(knownRuleIds: () => readonly string[]): Rule {
  return {
    id: 'config/valid',
    description: 'ddd-ts-kit.config.json is consistent: known contexts, classifications, relationships, rule ids and guard mode, and the same contexts as on disk.',
    scope: 'project',
    run(project) {
      const inspection = new Inspection(project, reporter(project, this.id));
      return [
        ...Object.entries(project.config.contexts).flatMap(([name, context]) => inspection.declaredContext(name, context)),
        ...inspection.undeclaredDirectories(),
        ...inspection.ruleSettings(knownRuleIds()),
        ...inspection.guardMode(),
      ];
    },
  };
}

class Inspection {
  constructor(
    private readonly project: Project,
    private readonly report: Report,
  ) {}

  declaredContext(name: string, context: ContextConfig): Violation[] {
    return [...this.#classification(name, context), ...context.upstreams.flatMap((upstream) => this.#upstream(name, upstream)), ...this.#presence(name, context)];
  }

  undeclaredDirectories(): Violation[] {
    const { contextsDir, contexts } = this.project.config;
    return this.project.contextsOnDisk
      .filter((name) => contexts[name] === undefined)
      .map((name) =>
        this.report(
          { file: `${contextsDir}/${name}`, line: 1 },
          `The directory ${contextsDir}/${name} is not a declared context.`,
          `Declare it under "contexts" in ${CONFIG_FILE} with its classification and upstreams.`,
        ),
      );
  }

  ruleSettings(known: readonly string[]): Violation[] {
    return Object.entries(this.project.config.rules).flatMap(([id, severity]) => {
      if (!known.includes(id)) return [this.#inConfig(id, `The rule "${id}" does not exist.`, 'Fix the id; `ddd-ts-kit rules` lists the valid ones.')];
      if (!isOneOf(SEVERITIES, severity)) return [this.#inConfig(id, `The rule "${id}" has the severity "${severity}".`, `Use one of: ${SEVERITIES.join(', ')}.`)];
      return [];
    });
  }

  guardMode(): Violation[] {
    const { guard } = this.project.config;
    if (isOneOf(GUARD_MODES, guard)) return [];
    return [this.#inConfig('guard', `"guard" is "${guard}".`, `Use one of: ${GUARD_MODES.join(', ')} (how the editor hook reacts to a violation: refuse the write, only report it, or stay silent).`)];
  }

  #classification(name: string, context: ContextConfig): Violation[] {
    if (isOneOf(CLASSIFICATIONS, context.classification)) return [];
    return [
      this.#inConfig(name, `The context "${name}" has the classification "${context.classification}".`, `Set contexts.${name}.classification to one of: ${CLASSIFICATIONS.join(', ')}.`),
    ];
  }

  #upstream(name: string, upstream: ContextConfig['upstreams'][number]): Violation[] {
    const violations: Violation[] = [];
    if (upstream.context === name) {
      violations.push(this.#inConfig(name, `The context "${name}" lists itself as an upstream.`, 'Remove the entry: a context does not depend on itself.'));
    } else if (this.project.config.contexts[upstream.context] === undefined) {
      const create = `\`ddd-ts-kit generate context ${upstream.context} --classification <core|supporting|generic>\``;
      violations.push(this.#inConfig(upstream.context, `The context "${name}" declares the unknown upstream "${upstream.context}".`, `Fix the name, or create the context with ${create}.`));
    }
    if (!isOneOf(RELATIONSHIPS, upstream.relationship)) {
      const message = `The relationship "${upstream.relationship}" between "${name}" and "${upstream.context}" is unknown.`;
      violations.push(this.#inConfig(upstream.relationship, message, `Use one of: ${RELATIONSHIPS.join(', ')}.`));
    }
    return violations;
  }

  #presence(name: string, context: ContextConfig): Violation[] {
    if (this.project.contextsOnDisk.includes(name)) return [];
    const { contextsDir } = this.project.config;
    const create = `\`ddd-ts-kit generate context ${name} --classification ${context.classification || 'core'}\``;
    return [this.#inConfig(name, `The context "${name}" is declared but ${contextsDir}/${name} does not exist.`, `Create it with ${create}, or remove it from the config.`)];
  }

  /** A violation located on the line of the config file that first quotes `needle`. */
  #inConfig(needle: string, message: string, fix: string): Violation {
    return this.report({ file: CONFIG_FILE, line: lineOf(this.project.configText, `"${needle}"`) }, message, fix);
  }
}
