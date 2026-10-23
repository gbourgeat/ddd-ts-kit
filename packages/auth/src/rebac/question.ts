import type { DerivedRelation } from './derived-relation';
import { derivedText } from './derived-text';
import { parseObject } from './parse-object';
import type { RelationTupleStore } from './relation-tuple-store';
import type { Schema } from './schema';
import type { TraceStep } from '../authorization/trace-step';
import type { Way } from './via';
import { waysOf } from './ways-of';

export interface QuestionOptions {
  readonly schema: Schema;
  readonly store: RelationTupleStore;
  /** `<type>:<id>` of who is asking, such as `user:ada`. */
  readonly subject: string;
  readonly maxDepth: number;
  /** A check stops at the first way that holds; an explanation visits every way. */
  readonly visit: 'first-way' | 'every-way';
}

/** Where a question stands: the questions above it, how deep it prints, and how it was reached. */
interface Position {
  readonly asked: readonly string[];
  readonly depth: number;
  /** ` (parent of document:q3)` for a question asked through `via`; empty otherwise. */
  readonly because: string;
}

/** A stored relation of one element: `editor` of `document:1`. */
interface Related {
  readonly element: string;
  readonly relation: string;
}

/**
 * "Does the subject hold `name` on `element`?", answered by reading the tuples the schema says
 * to read. A stored relation is answered by its tuples; a derived one by its ways. Every
 * question asked on the way is one line of the trace.
 */
export class Question {
  readonly trace: TraceStep[] = [];
  private cutByDepthLimit = false;

  constructor(private readonly options: QuestionOptions) {}

  /** True when a branch was cut by the depth limit: the answer is then not to be trusted. */
  get depthExceeded(): boolean {
    return this.cutByDepthLimit;
  }

  holds(element: string, name: string): Promise<boolean> {
    return this.ask(element, name, { asked: [], depth: 0, because: '' });
  }

  private async ask(element: string, name: string, at: Position): Promise<boolean> {
    const here = `${element} ${name}`;

    if (at.asked.includes(here)) {
      return this.note(at.depth, `${here}${at.because}: already being asked above, a cycle in the tuples`, 'cut');
    }

    if (at.asked.length >= this.options.maxDepth) {
      this.cutByDepthLimit = true;

      return this.note(at.depth, `${here}${at.because}: the depth limit (${this.options.maxDepth}) cuts here`, 'cut');
    }

    const { type } = parseObject(element);

    if (this.options.schema.relations(type)[name] !== undefined) {
      return this.someoneIs({ element, relation: name }, at);
    }

    const derived = this.options.schema.derived(type)[name];

    if (derived === undefined) {
      return this.note(at.depth, `${here}${at.because}: "${type}" declares no "${name}"`, 'no');
    }

    this.note(at.depth, `${here}${at.because} = ${derivedText(derived)}`, 'yes');

    return this.derivedHolds(element, derived, below(at, here));
  }

  /** A stored relation: one of its tuples names the subject, or names what stands for a set the subject is in. */
  private async someoneIs(of: Related, at: Position): Promise<boolean> {
    const tuples = await this.options.store.readByObject(of.element, of.relation);

    if (tuples.length === 0) {
      return this.note(at.depth, `nobody is ${of.relation} of ${of.element}${at.because}`, 'no');
    }

    let holds = false;

    for (const { subject } of tuples) {
      holds = (await this.subjectIs(subject, of, at)) || holds;

      if (holds && this.options.visit === 'first-way') {
        break;
      }
    }

    return holds;
  }

  private async subjectIs(subject: string, of: Related, at: Position): Promise<boolean> {
    const standsFor = this.options.schema.standsFor(
      parseObject(of.element).type,
      of.relation,
      parseObject(subject).type,
    );

    if (standsFor === undefined) {
      const isTheSubject = subject === this.options.subject;
      const text = `${subject} is ${of.relation} of ${of.element}${at.because}${isTheSubject ? ': the actor' : ''}`;

      return this.note(at.depth, text, isTheSubject ? 'yes' : 'no');
    }

    this.note(at.depth, `the ${standsFor}s of ${subject} are ${of.relation} of ${of.element}${at.because}`, 'yes');

    return this.ask(subject, standsFor, below(at, `${of.element} ${of.relation}`));
  }

  private async derivedHolds(element: string, derived: DerivedRelation, at: Position): Promise<boolean> {
    const { anyOf, allOf, butNot } = waysOf(derived);

    const some = anyOf.length === 0 || (await this.someWay(element, anyOf, at));
    const every = some && (await this.everyWay(element, allOf, at));

    return every && !(await this.someWay(element, butNot, at));
  }

  private async someWay(element: string, ways: readonly Way[], at: Position): Promise<boolean> {
    let holds = false;

    for (const way of ways) {
      holds = (await this.wayHolds(element, way, at)) || holds;

      if (holds && this.options.visit === 'first-way') {
        return true;
      }
    }

    return holds;
  }

  private async everyWay(element: string, ways: readonly Way[], at: Position): Promise<boolean> {
    for (const way of ways) {
      if (!(await this.wayHolds(element, way, at))) {
        return false;
      }
    }

    return true;
  }

  /** A name is asked of the same element; `via` reads the related elements and asks each of them. */
  private async wayHolds(element: string, way: Way, at: Position): Promise<boolean> {
    if (typeof way === 'string') {
      return this.ask(element, way, at);
    }

    const related = await this.options.store.readByObject(element, way.via);

    if (related.length === 0) {
      return this.note(at.depth, `${element} has no ${way.via}`, 'no');
    }

    let holds = false;

    for (const { subject } of related) {
      holds = (await this.ask(subject, way.holds, { ...at, because: ` (${way.via} of ${element})` })) || holds;

      if (holds && this.options.visit === 'first-way') {
        break;
      }
    }

    return holds;
  }

  private note(depth: number, text: string, answer: TraceStep['answer']): boolean {
    this.trace.push({ depth, text, answer });

    return answer === 'yes';
  }
}

/** The position of the questions a question asks: one deeper, with it among the questions above. */
function below(at: Position, here: string): Position {
  return { asked: [...at.asked, here], depth: at.depth + 1, because: '' };
}
