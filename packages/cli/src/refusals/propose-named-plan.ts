import type { Config } from '../config';
import { toName } from '../naming';
import type { Workspace } from '../workspace';
import { aggregatesOf } from './aggregates-of';
import type { ConceptErrorClass } from './concept-error-class';
import { conceptNamed } from './concept-named';
import { factoryForParameter } from './factory-for-parameter';
import type { LegacyError } from './legacy-error';
import type { NamedPlan } from './named-plan';
import type { PlannedRefusal } from './planned-refusal';

const NOT_FOUND = /^(?:([A-Z0-9_]+?)_NOT_FOUND|NOT_FOUND_([A-Z0-9_]+))$/;

interface Tree {
  readonly ws: Workspace;
  readonly config: Config;
}

/** What builds the refusals of a project today: classes per error, and factories of error classes per concept. */
export interface RefusalSources {
  readonly legacy: readonly LegacyError[];
  readonly concepts: readonly ConceptErrorClass[];
}

/**
 * A proposal: each refusal becomes a class named after its code (a thing not found is unknown),
 * which it keeps, with one factory named after what it is refused on, its first parameter
 * (`AppointmentError.bookingTooFar(horizon)` becomes `BookingTooFar.forHorizon`, `ended(appointmentId)`
 * becomes `AppointmentEnded.forAppointment`), or the concept when the factory has no parameter to say it. The names are decisions of the model:
 * the proposal is edited before it is applied. A factory whose code is not a literal is left out:
 * it moves by hand.
 */
export function proposeNamedPlan(sources: RefusalSources, tree: Tree): NamedPlan {
  const contexts: Record<string, PlannedRefusal[]> = {};

  const add = (context: string, entry: PlannedRefusal, fallback: string): void => {
    const planned = (contexts[context] ??= []);
    const taken = planned.some((other) => other.class === entry.class && other.factory === entry.factory);

    planned.push(taken ? { ...entry, factory: `for${toName(fallback).pascal}` } : entry);
  };

  for (const concept of sources.concepts) {
    const subject = concept.className.replace(/Error$/, '');

    for (const { name, code, parameter } of concept.factories) {
      if (code !== undefined) {
        const from = `${concept.className}.${name}`;
        const factory = factoryForParameter(parameter) ?? `for${subject}`;

        add(concept.context, { from, file: concept.file, code, class: classNameOf(code), factory }, name);
      }
    }
  }

  for (const error of sources.legacy) {
    const factory = legacyFactory(error, conceptNamed(error.className, aggregatesOf(tree, error.context)));

    const entry = {
      from: error.className,
      file: error.file,
      code: error.code,
      class: classNameOf(error.code),
      factory,
    };

    add(error.context, entry, error.className.replace(/Error$/, ''));
  }

  return { to: 'named', contexts };
}

/**
 * The PascalCase of the code, never ending in `Error`: `APPOINTMENT_ENDED` gives `AppointmentEnded`.
 * A thing not found is unknown to the business, which has no word "found": `INVOICE_NOT_FOUND` and
 * `NOT_FOUND_INVOICE` give `UnknownInvoice`, the code kept.
 */
function classNameOf(code: string): string {
  const missing = NOT_FOUND.exec(code);
  const subject = missing?.[1] ?? missing?.[2];
  const pascal = subject === undefined ? toName(code).pascal : `Unknown${toName(subject).pascal}`;
  const bare = pascal.replace(/Error$/, '');

  return bare === '' ? pascal : bare;
}

/**
 * As for a factory of a concept class: its first parameter, else the concept the class is named
 * after, else the context. A constructor that takes only the message (a class without one does)
 * says nothing about the refusal: the concept, when the class is named after one, says more.
 */
function legacyFactory(error: LegacyError, concept: string): string {
  const [first] = error.parameters;
  const told = first?.name === 'message' && concept !== '';
  const named = told ? undefined : factoryForParameter(first?.name);

  return named ?? `for${concept === '' ? toName(error.context).pascal : concept}`;
}
