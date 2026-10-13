import type { Actor } from '@ddd-ts-kit/kernel';
import type { FieldDecider } from './field-decider.js';
import type { FieldRequirement } from './field-requirement.js';
import type { FieldRule } from './field-rule.js';

/**
 * The decisions about the fields of one request, for one actor. A requirement about no element
 * is asked once; one about an element is asked once per element among the last ones met, so a
 * page of a hundred rows of one calendar asks once, and a long export with an element per row
 * asks once per row while holding a bounded memory. Without a decider, a restricted field is
 * refused to everybody: nothing is shown by omission. A judge that `records` keeps its decisions
 * in the audit trail: the one that checks a body, whose refusal is an act refused.
 */
export class FieldJudge {
  /**
   * The elements a judge remembers a decision about, for each requirement: enough for a page of
   * rows that share a few elements, bounded so that a streamed export with an element per row
   * holds no more than this many, whatever its length.
   */
  static readonly rememberedSubjects = 256;

  private readonly withoutSubject = new Map<FieldRequirement, Promise<boolean>>();

  private readonly bySubject = new Map<FieldRequirement, Map<unknown, Promise<boolean>>>();

  constructor(
    private readonly actor: Actor,
    private readonly decide: FieldDecider | undefined,
    private readonly records = false,
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
    if (subject === undefined) {
      const known = this.withoutSubject.get(requirement) ?? this.asked(requirement, subject);

      this.withoutSubject.set(requirement, known);

      return known;
    }

    return this.aboutElement(requirement, subject);
  }

  private aboutElement(requirement: FieldRequirement, subject: unknown): Promise<boolean> {
    const remembered = this.bySubject.get(requirement) ?? new Map<unknown, Promise<boolean>>();
    const key = keyOf(subject);
    const known = remembered.get(key);

    if (known !== undefined) {
      return known;
    }

    const decided = this.asked(requirement, subject);

    forgetOldest(remembered);
    remembered.set(key, decided);
    this.bySubject.set(requirement, remembered);

    return decided;
  }

  private asked(requirement: FieldRequirement, subject: unknown): Promise<boolean> {
    if (this.decide === undefined) {
      return Promise.resolve(false);
    }

    return this.decide({ actor: this.actor, requirement, subject, recorded: this.records });
  }
}

/** Makes room for one more element: the one met first is forgotten, and asked again if it comes back. */
function forgetOldest(remembered: Map<unknown, Promise<boolean>>): void {
  if (remembered.size < FieldJudge.rememberedSubjects) {
    return;
  }

  const [oldest] = remembered.keys();

  remembered.delete(oldest);
}

/** A reference `{ type, id }` built anew for every row names the same element: it is keyed by what it says. */
function keyOf(subject: unknown): unknown {
  if (typeof subject !== 'object' || subject === null || !('type' in subject) || !('id' in subject)) {
    return subject;
  }

  const { type, id } = subject;

  return typeof type === 'string' && typeof id === 'string' ? `${type}:${id}` : subject;
}
