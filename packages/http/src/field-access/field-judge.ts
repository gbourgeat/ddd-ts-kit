import type { Actor } from '@ddd-ts-kit/kernel';
import type { FieldDecider } from './field-decider.js';
import type { FieldRequirement } from './field-requirement.js';
import type { FieldRule } from './field-rule.js';

/**
 * The decisions about the fields of one request, for one actor, each asked once: a page of a
 * hundred rows asks a requirement about the same element once. Without a decider, a restricted
 * field is refused to everybody: nothing is shown by omission.
 */
export class FieldJudge {
  private readonly decisions = new Map<FieldRequirement, Map<unknown, Promise<boolean>>>();

  constructor(
    private readonly actor: Actor,
    private readonly decide: FieldDecider | undefined,
  ) {}

  /** Whether the actor may see the field held by `container`. */
  async reads(rule: FieldRule, container: unknown): Promise<boolean> {
    return rule.read === undefined || (await this.allows(rule.read, rule.subject?.(container)));
  }

  /** Whether the actor may set the field held by `container`: see it, and meet its write requirement. */
  async writes(rule: FieldRule, container: unknown): Promise<boolean> {
    if (!(await this.reads(rule, container))) {
      return false;
    }

    return rule.write === undefined || (await this.allows(rule.write, rule.subject?.(container)));
  }

  private allows(requirement: FieldRequirement, subject: unknown): Promise<boolean> {
    const bySubject = this.decisions.get(requirement) ?? new Map<unknown, Promise<boolean>>();
    const key = keyOf(subject);
    const known = bySubject.get(key);

    if (known !== undefined) {
      return known;
    }

    const decided = this.decide === undefined ? Promise.resolve(false) : this.decide(this.actor, requirement, subject);

    bySubject.set(key, decided);
    this.decisions.set(requirement, bySubject);

    return decided;
  }
}

/** A reference `{ type, id }` built anew for every row names the same element: it is keyed by what it says. */
function keyOf(subject: unknown): unknown {
  if (typeof subject !== 'object' || subject === null || !('type' in subject) || !('id' in subject)) {
    return subject;
  }

  const { type, id } = subject;

  return typeof type === 'string' && typeof id === 'string' ? `${type}:${id}` : subject;
}
