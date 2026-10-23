import { scan } from '../check/scan/scan.js';
import type { Workspace } from '../workspace/index.js';
import { objectProperties, type PropertyValue } from './object-properties.js';
import { readVocabularies } from './read-vocabularies.js';
import type { StateMachineFacts, TransitionFacts } from './state-machine-facts.js';
import { type ContextTree, roleFilesOf } from '../model-modules/index.js';

const FOLDER = 'domain/state-machines';
const SUFFIX = '.state-machine.ts';
const DEFINE = /(?<![\w$.])defineStateMachine\s*\(\s*\{/;

/**
 * The state machines of a context, one per `domain/state-machines/*.state-machine.ts`, read from
 * the object given to `defineStateMachine`. A state is written as a string literal or as a member
 * of a closed vocabulary (`AppointmentStatus.Booked`, `AppointmentStatus['no-show']`), whose value
 * is read from `domain/vocabularies/` of the context when it is declared there.
 */
export function readStateMachines(ws: Workspace, tree: ContextTree): StateMachineFacts[] {
  const vocabularies = readVocabularies(ws, tree);

  return roleFilesOf(ws, tree, FOLDER)
    .filter(({ name }) => name.endsWith(SUFFIX))
    .flatMap(({ name, path: file }) => {
      const facts = machineOf(ws.read(file) ?? '', vocabularies);

      return facts === undefined ? [] : [{ aggregate: name.slice(0, -SUFFIX.length), file, ...facts }];
    });
}

type Declared = Omit<StateMachineFacts, 'aggregate' | 'file'>;

type Vocabularies = ReadonlyMap<string, ReadonlyMap<string, string>>;

function machineOf(text: string, vocabularies: Vocabularies): Declared | undefined {
  const { code } = scan(text);
  const call = DEFINE.exec(code);

  if (call === null) {
    return undefined;
  }

  const properties = objectProperties(code, text, call.index + call[0].length - 1);
  const valueOf = (name: string): string => slice(text, properties.get(name));
  const states = (written: string) => statesIn(written, vocabularies);
  const transitions = transitionsOf({ code, text, states }, properties.get('transitions'));
  const initial = states(valueOf('initial'));
  const listed = listedStates(valueOf('states'), vocabularies);

  return { states: listed.length > 0 ? listed : mentioned(initial, transitions), initial, transitions };
}

/** `[...]`, or `Object.values(<vocabulary>)` of a vocabulary of the context. */
function listedStates(written: string, vocabularies: Vocabularies): string[] {
  const values = /^Object\.values\(\s*([\w$]+)\s*\)$/.exec(written)?.[1];

  if (values !== undefined) {
    return [...(vocabularies.get(values)?.values() ?? [])];
  }

  return written.startsWith('[') ? statesIn(written, vocabularies) : [];
}

interface Source {
  readonly code: string;
  readonly text: string;
  readonly states: (written: string) => string[];
}

function transitionsOf({ code, text, states }: Source, value: PropertyValue | undefined): TransitionFacts[] {
  const open = value === undefined ? -1 : code.indexOf('{', value.start);

  if (value === undefined || open === -1 || open >= value.end) {
    return [];
  }

  return [...objectProperties(code, text, open)].map(([name, written]) => {
    const inner = code.indexOf('{', written.start);
    const fields = objectProperties(code, text, inner);
    const to = states(slice(text, fields.get('to')))[0];

    return {
      name,
      from: states(slice(text, fields.get('from'))),
      ...(to === undefined ? {} : { to }),
      guarded: fields.has('guard'),
    };
  });
}

function slice(text: string, value: PropertyValue | undefined): string {
  return value === undefined ? '' : text.slice(value.start, value.end).trim();
}

const STATE = /^(?:(['"`])(.+)\1|([\w$]+)\.([\w$]+)|([\w$]+)\[\s*(['"`])(.+)\6\s*\])$/;

/** The states written in a list `[a, b]` or as one value: a literal, or a member of a vocabulary, read as its value. */
function statesIn(written: string, vocabularies: Vocabularies): string[] {
  const items = written.startsWith('[') ? written.slice(1, written.lastIndexOf(']')).split(',') : [written];

  return items.flatMap((item) => {
    const [, , quoted, owner, member, indexedOwner, , indexed] = STATE.exec(item.trim()) ?? [];
    const key = member ?? indexed;

    const state =
      quoted ?? (key === undefined ? undefined : (vocabularies.get(owner ?? indexedOwner ?? '')?.get(key) ?? key));

    return state === undefined ? [] : [state];
  });
}

function mentioned(initial: readonly string[], transitions: readonly TransitionFacts[]): string[] {
  const all = [...initial, ...transitions.flatMap(({ from, to }) => (to === undefined ? from : [...from, to]))];

  return [...new Set(all)];
}
