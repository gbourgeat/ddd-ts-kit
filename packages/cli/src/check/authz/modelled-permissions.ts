import type { SourceFile } from '../model/source-file';
import { callArguments } from '../text/call-arguments';
import type { ListPart } from '../text/list-part';
import { matchingBracket } from '../text/matching-bracket';
import type { PermissionSet } from './permission-sets';

const DEFINE_SCHEMA = /\bdefineSchema\s*\(/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const SPREAD = /^\.\.\.\s*([A-Za-z_$][\w$]*)$/;
const PROPERTY = /^([A-Za-z_$][\w$]*)\s*:\s*/;
const DERIVED = /^derived\s*:\s*/;
/** `billingPermissions['invoice.view'].id`, the key of a derived relation named after a permission. */
const PERMISSION_ID = /^([A-Za-z_$][\w$]*)\s*\[\s*$/;

/** A permission a type of the relationship schema derives: the right is decided on that type. */
export interface ModelledPermission {
  /** The id of the permission, `billing:invoice.view`. */
  readonly id: string;
  readonly type: string;
}

/** A part of the schema the checker cannot read, and where it stands. */
interface UnreadSchema {
  readonly line: number;
  readonly what: string;
}

export interface ModelledSchema {
  readonly file: SourceFile;
  readonly modelled: readonly ModelledPermission[];
  readonly unread: readonly UnreadSchema[];
  /** Whether the operators of the context hold this permission: the context derives it, or every permission no element derives. */
  contextHolds(id: string): boolean;
}

/**
 * The permissions the types other than `context` derive in the relationship schema, read from
 * the object given to `defineSchema`: the types written in place, and those of an `elements`
 * object the schema spreads. A derived relation named after a permission is a string key
 * (`'billing:invoice.view'`) or a computed one (`[billingPermissions['invoice.view'].id]`, or a
 * constant of the file holding it). A relation named otherwise (`edit`) grants no permission.
 * Anything else (a schema built by a call, another spread, a type held elsewhere, a key computed
 * in another way) is unread, and said so.
 */
export function modelledPermissions(file: SourceFile, sets: readonly PermissionSet[]): ModelledSchema {
  const reader = new Reader(file, sets);

  reader.schema();

  return {
    file,
    modelled: reader.modelled,
    unread: reader.unread,
    contextHolds: (id) =>
      reader.context.all ||
      reader.context.listed.includes(id) ||
      (reader.context.unmodelled && !reader.modelled.some((entry) => entry.id === id)),
  };
}

class Reader {
  readonly modelled: ModelledPermission[] = [];
  readonly unread: UnreadSchema[] = [];
  /** What the type `context` derives: every permission, every one no element derives, or the ones it lists. */
  readonly context: { all: boolean; unmodelled: boolean; listed: string[] } = {
    all: false,
    unmodelled: false,
    listed: [],
  };

  constructor(
    private readonly file: SourceFile,
    private readonly sets: readonly PermissionSet[],
  ) {}

  schema(): void {
    const { code } = this.file.scan;
    const call = DEFINE_SCHEMA.exec(code);

    if (call === null) {
      this.refuse(0, 'the schema is not built by a call of defineSchema in this file');

      return;
    }

    const argument = callArguments(code, call.index + call[0].length - 1)[0];

    if (argument === undefined || !argument.code.startsWith('{')) {
      this.refuse(call.index, 'the types are not an object literal given to defineSchema');

      return;
    }

    this.types(argument, 0);
  }

  private types(object: ListPart, depth: number): void {
    for (const property of callArguments(this.file.scan.code, object.start)) {
      this.type(property, depth);
    }
  }

  private type(property: ListPart, depth: number): void {
    const spread = SPREAD.exec(property.code)?.[1];

    if (spread !== undefined) {
      this.spread(spread, property, depth);

      return;
    }

    const key = PROPERTY.exec(property.code);

    if (key === null) {
      this.refuse(property.start, `\`${property.code}\` is not a type written as \`name: { ... }\``);

      return;
    }

    const value = property.code.slice(key[0].length);

    if (!value.startsWith('{')) {
      this.refuse(property.start, `the type \`${key[1] ?? ''}\` is not an object literal`);

      return;
    }

    this.derivedOn(key[1] ?? '', { code: value, start: property.start + key[0].length });
  }

  private spread(name: string, at: ListPart, depth: number): void {
    const declaration = new RegExp(`\\b(?:const|let|var)\\s+${name}\\b[^=;]*=\\s*(?=\\{)`).exec(this.file.scan.code);

    if (name !== 'elements' || declaration === null || depth > 0) {
      this.refuse(at.start, `\`...${name}\` is not the \`elements\` object of this file`);

      return;
    }

    const start = declaration.index + declaration[0].length;

    this.types({ code: this.file.scan.code.slice(start), start }, depth + 1);
  }

  private derivedOn(type: string, object: ListPart): void {
    const derived = callArguments(this.file.scan.code, object.start).find(({ code }) => DERIVED.test(code));

    if (derived === undefined) {
      return;
    }

    const value = derived.code.replace(DERIVED, '');
    const start = derived.start + derived.code.length - value.length;

    if (type === 'context') {
      this.contextDerives(value, start);

      return;
    }

    if (!value.startsWith('{')) {
      this.refuse(derived.start, `the relations \`${type}\` derives are not an object literal`);

      return;
    }

    for (const relation of callArguments(this.file.scan.code, start)) {
      this.relation(type, relation);
    }
  }

  /** `Object.fromEntries(permissions.all()...)` holds every permission, with a `.filter(` the ones no element derives. */
  private contextDerives(value: string, start: number): void {
    if (value.startsWith('{')) {
      const before = this.modelled.length;

      for (const relation of callArguments(this.file.scan.code, start)) {
        this.relation('context', relation);
      }

      this.context.listed.push(...this.modelled.splice(before).map(({ id }) => id));
    } else if (value.startsWith('Object.fromEntries(')) {
      this.context.all = !value.includes('.filter(');
      this.context.unmodelled = value.includes('.filter(');
    }
  }

  private relation(type: string, relation: ListPart): void {
    const { code, strings } = this.file.scan;

    if (relation.code.startsWith('[')) {
      const end = matchingBracket(code, relation.start);
      const id = this.permissionId(code.slice(relation.start + 1, end), relation.start + 1);

      if (id === undefined) {
        this.refuse(
          relation.start,
          `the key \`${relation.code.slice(0, end - relation.start + 1)}\` of \`${type}\` is computed in a way the checker cannot resolve`,
        );
      } else {
        this.modelled.push({ id, type });
      }

      return;
    }

    const quoted = strings.find(({ start }) => start === relation.start)?.value;

    if (quoted !== undefined && /^[\w-]+:/.test(quoted)) {
      this.modelled.push({ id: quoted, type });
    }
  }

  /** `billingPermissions['invoice.view'].id`, written in place or held in a constant of the file. */
  private permissionId(expression: string, at: number): string | undefined {
    const { code, strings } = this.file.scan;
    const text = expression.trim();
    const offset = at + expression.indexOf(text);
    const open = text.indexOf('[');

    if (open > 0 && PERMISSION_ID.test(text.slice(0, open + 1)) && /\]\s*\.id$/.test(text)) {
      const set = this.sets.find(({ set: name }) => name === text.slice(0, open).trim());
      const key = strings.find(({ start }) => start > offset + open && start < offset + text.length)?.value;

      return set === undefined || key === undefined ? undefined : `${set.context}:${key}`;
    }

    if (!IDENTIFIER.test(text)) {
      return undefined;
    }

    const held = new RegExp(`\\b(?:const|let|var)\\s+${text}\\b[^=;]*=\\s*`).exec(code);

    if (held === null) {
      return undefined;
    }

    const start = held.index + held[0].length;
    const end = code.indexOf(';', start);

    return end === -1 ? undefined : this.permissionId(code.slice(start, end), start);
  }

  private refuse(offset: number, what: string): void {
    this.unread.push({ line: this.file.scan.lineAt(offset), what });
  }
}
