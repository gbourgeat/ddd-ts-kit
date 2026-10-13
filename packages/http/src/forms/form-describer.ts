import type { FieldJudge } from '../field-access/field-judge.js';
import type { FieldTree } from '../field-access/field-tree.js';
import type { SchemaNode } from '../schema/schema-node.js';
import { isRecord } from '../support/is-record.js';
import { constraintsOf } from './constraints-of.js';
import type { FieldBlock } from './field-block.js';
import type { FieldHint } from './field-hint.js';
import type { FormBlock } from './form-block.js';
import type { FormGroupHint } from './form-group-hint.js';
import type { FormHints } from './form-hints.js';
import type { FieldLookup } from './field-lookup.js';
import { widgetOf } from './widget-of.js';

const MAX_DEPTH = 8;

/** What a form is described from: the request schema, its hints, the caller and the values the request gave. */
export interface FormSource {
  readonly operation: string;
  readonly body: SchemaNode;
  readonly fields: FieldTree;
  readonly hints: FormHints;
  readonly lookups: ReadonlyMap<string, FieldLookup>;
}

/** One object of the body being described: its schema, its restricted fields, the values given for it, and its path. */
interface Level {
  readonly node: SchemaNode;
  readonly fields: FieldTree;
  readonly values: Readonly<Record<string, unknown>>;
  readonly prefix: string;
}

/**
 * The blocks of a form, for one caller: a field the caller may not see is absent, one they may
 * not set is read-only, constraints and options come from the schema, layout and conditions
 * from the hints. It describes; the route that receives the body still validates it, and its
 * use case still enforces its rules.
 */
export class FormDescriber {
  constructor(
    private readonly source: FormSource,
    private readonly judge: FieldJudge,
  ) {}

  async blocks(values: Readonly<Record<string, unknown>>): Promise<FormBlock[]> {
    const { body, fields, hints } = this.source;
    const level: Level = { node: body, fields, values, prefix: '' };
    const described = await this.fieldsOf(level);

    return [...this.grouped(hints.groups ?? [], described), ...ungrouped(hints.groups ?? [], described)];
  }

  private grouped(groups: readonly FormGroupHint[], described: ReadonlyMap<string, FieldBlock>): FormBlock[] {
    return groups.map((group) => ({
      type: 'group',
      name: group.name,
      label: `${this.source.operation}.${group.name}`,
      blocks: [
        ...group.fields.flatMap((name) => {
          const block = described.get(name);

          return block === undefined ? [] : [block];
        }),
        ...this.grouped(group.groups ?? [], described),
      ],
    }));
  }

  /** Every field of one object the caller may see, by name, in the order of the schema. */
  private async fieldsOf(level: Level): Promise<Map<string, FieldBlock>> {
    const required = new Set(level.node.required());
    const blocks = new Map<string, FieldBlock>();

    for (const [name, node] of level.node.properties()) {
      const block = await this.field({ name, node, required: required.has(name) }, level);

      if (block !== undefined) {
        blocks.set(name, block);
      }
    }

    return blocks;
  }

  private async field(property: Property, level: Level): Promise<FieldBlock | undefined> {
    const rule = level.fields.own().find(([name]) => name === property.name)?.[1];

    if (rule !== undefined && !(await this.judge.reads(rule, level.values))) {
      return undefined;
    }

    const readOnly = rule !== undefined && !(await this.judge.writes(rule, level.values));
    const path = `${level.prefix}${property.name}`;
    const value = level.values[property.name];

    return {
      ...(await this.shapeOf(property, { ...level, prefix: `${path}.` })),
      name: path,
      label: this.hintOf(path)?.label ?? `${this.source.operation}.${path}`,
      required: property.required,
      ...(readOnly ? { readOnly: true } : {}),
      ...(value === undefined ? {} : { value }),
    };
  }

  /** What depends on the schema of the field and its hint: widget, constraints, options, conditions, nested fields. */
  private async shapeOf(
    { name, node }: Property,
    below: Level,
  ): Promise<Omit<FieldBlock, 'name' | 'label' | 'required'>> {
    const path = below.prefix.slice(0, -1);
    const hint = this.hintOf(path) ?? {};

    if (node.type() === 'object' && node.properties().length > 0) {
      const values = below.values[name];

      // A schema that holds itself (a tree) is described a few levels deep, not without end.
      if (below.prefix.split('.').length > MAX_DEPTH) {
        return { type: 'field', widget: 'group', blocks: [] };
      }

      const nested = {
        node,
        fields: below.fields.below(name),
        values: isRecord(values) ? values : {},
        prefix: below.prefix,
      };

      return { type: 'field', widget: 'group', blocks: [...(await this.fieldsOf(nested)).values()] };
    }

    return {
      type: 'field',
      widget: hint.widget ?? widgetOf(node),
      ...constraintsOf(node),
      ...this.choicesOf(path, node, hint),
      ...conditionsOf(hint),
    };
  }

  private choicesOf(path: string, node: SchemaNode, hint: FieldHint): Partial<FieldBlock> {
    const listed = node.type() === 'array' ? node.items() : node;
    const values = enumerated(listed) ?? hint.options;
    const lookup = hint.lookup === undefined ? undefined : this.source.lookups.get(hint.lookup);

    return {
      ...(values === undefined
        ? {}
        : { options: values.map((value) => ({ value, label: `${this.source.operation}.${path}.${String(value)}` })) }),
      ...(node.type() === 'array' && values !== undefined ? { multiple: true, widget: hint.widget ?? 'select' } : {}),
      ...(lookup === undefined ? {} : { lookup }),
    };
  }

  private hintOf(path: string): FieldHint | undefined {
    return this.source.hints.fields?.[path];
  }
}

interface Property {
  readonly name: string;
  readonly node: SchemaNode;
  readonly required: boolean;
}

function ungrouped(groups: readonly FormGroupHint[], described: ReadonlyMap<string, FieldBlock>): FieldBlock[] {
  const placed = new Set(
    groups.flatMap(function names(group: FormGroupHint): string[] {
      return [...group.fields, ...(group.groups ?? []).flatMap(names)];
    }),
  );

  return [...described].filter(([name]) => !placed.has(name)).map(([, block]) => block);
}

function enumerated(node: SchemaNode): readonly (string | number | boolean)[] | undefined {
  const values = node.node['enum'];

  if (!Array.isArray(values)) {
    return undefined;
  }

  return values.filter(isOption);
}

function isOption(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function conditionsOf({ visibleWhen, requiredWhen }: FieldHint): Partial<FieldBlock> {
  return {
    ...(visibleWhen === undefined ? {} : { visibleWhen }),
    ...(requiredWhen === undefined ? {} : { requiredWhen }),
  };
}
