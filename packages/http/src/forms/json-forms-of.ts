import type { JsonSchema } from '@ddd-ts-kit/validation';
import type { SchemaNode } from '../schema/schema-node';
import { isRecord } from '../support/is-record';
import type { FieldBlock } from './field-block';
import type { FormBlock } from './form-block';
import type { FormCondition } from './form-condition';
import type { FormDescription } from './form-description';
import type { JsonForm } from './json-form';

const MAX_DEPTH = 16;
const WIDGET_FORMATS: Readonly<Partial<Record<string, string>>> = { datetime: 'date-time', date: 'date', time: 'time' };
/** What a schema says of itself and of other documents, which a self-contained form schema does not need. */
const LEFT_OUT = new Set(['$ref', '$defs', 'definitions', '$schema', '$id', 'x-field-access']);

/**
 * The form in JSON Forms, the recommended default: a JSON Schema of what the caller may see
 * (read-only where they may not set), a UI schema of groups and controls whose labels are
 * translation keys (`i18n`), rules for conditional visibility, `if`/`then` for a field required
 * by a condition, and the values the request gave as `data`. Every renderer of JSON Forms
 * (React, Angular, Vue) takes the three as they are.
 */
export function jsonFormsOf(
  description: FormDescription,
  body: SchemaNode,
  data: Readonly<Record<string, unknown>>,
): JsonForm {
  return {
    schema: objectSchema(description.blocks, body),
    uischema: { type: 'VerticalLayout', elements: elementsOf(description.blocks, '#') },
    data: visibleData(description.blocks, data),
  };
}

/** The values the request gave, for the fields the caller sees only: a hidden field is not echoed back. */
function visibleData(blocks: readonly FormBlock[], data: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    fieldsOf(blocks).flatMap((field) => {
      const name = lastSegment(field.name);
      const value = data[name];

      if (value === undefined) {
        return [];
      }

      return [[name, field.widget === 'group' && isRecord(value) ? visibleData(field.blocks ?? [], value) : value]];
    }),
  );
}

/** The schema of one object of the form, its properties in the order of the request schema whatever the layout. */
function objectSchema(blocks: readonly FormBlock[], node: SchemaNode): JsonSchema {
  const children = new Map(node.properties());
  const order = [...children.keys()];

  const fields = fieldsOf(blocks).sort(
    (a, b) => order.indexOf(lastSegment(a.name)) - order.indexOf(lastSegment(b.name)),
  );

  const conditional = fields.flatMap((field) =>
    field.requiredWhen === undefined ? [] : [requiredWhen(field, field.requiredWhen)],
  );

  return {
    type: 'object',
    properties: Object.fromEntries(
      fields.map((field) => {
        const child = children.get(lastSegment(field.name));

        return [lastSegment(field.name), child === undefined ? {} : propertySchema(field, child)];
      }),
    ),
    required: fields.filter((field) => field.required).map((field) => lastSegment(field.name)),
    ...(conditional.length === 0 ? {} : { allOf: conditional }),
  };
}

function propertySchema(field: FieldBlock<FormBlock>, node: SchemaNode): JsonSchema {
  if (field.widget === 'group') {
    return { ...objectSchema(field.blocks ?? [], node), ...(field.readOnly === true ? { readOnly: true } : {}) };
  }

  const own = inlined(node, 0);

  return {
    ...own,
    ...(field.readOnly === true ? { readOnly: true } : {}),
    ...(field.options !== undefined && own['enum'] === undefined && field.multiple !== true
      ? { enum: field.options.map(({ value }) => value) }
      : {}),
    ...formatOf(field),
  };
}

/** A widget of an instant says the format a renderer picks its control by, whatever format the schema library wrote. */
function formatOf({ widget }: FieldBlock<FormBlock>): JsonSchema {
  const format = WIDGET_FORMATS[widget];

  return format === undefined ? {} : { format };
}

/** The node with every reference followed, so the form schema holds itself. */
function inlined(node: SchemaNode, depth: number): JsonSchema {
  const own = Object.fromEntries(Object.entries(node.node).filter(([key]) => !LEFT_OUT.has(key)));

  if (depth >= MAX_DEPTH) {
    return own;
  }

  const properties = node.properties();

  return {
    ...own,
    ...(properties.length === 0
      ? {}
      : { properties: Object.fromEntries(properties.map(([name, child]) => [name, inlined(child, depth + 1)])) }),
    ...(isRecord(node.node['items']) ? { items: inlined(node.items(), depth + 1) } : {}),
  };
}

function elementsOf(blocks: readonly FormBlock[], scope: string): JsonSchema[] {
  return blocks.map((block) => {
    if (block.type === 'group') {
      return { type: 'Group', label: block.label, i18n: block.label, elements: elementsOf(block.blocks, scope) };
    }

    const own = `${scope}/properties/${lastSegment(block.name)}`;

    if (block.widget === 'group') {
      return { type: 'Group', label: block.label, i18n: block.label, elements: elementsOf(block.blocks ?? [], own) };
    }

    return control(block, own);
  });
}

function control(field: FieldBlock<FormBlock>, scope: string): JsonSchema {
  const options = {
    ...(field.widget === 'textarea' ? { multi: true } : {}),
    ...(field.widget === 'radio' ? { format: 'radio' } : {}),
    ...(field.readOnly === true ? { readonly: true } : {}),
    ...(field.lookup === undefined ? {} : { lookup: field.lookup }),
  };

  return {
    type: 'Control',
    scope,
    i18n: field.label,
    ...(Object.keys(options).length === 0 ? {} : { options }),
    ...(field.visibleWhen === undefined ? {} : { rule: { effect: 'SHOW', condition: conditionOf(field.visibleWhen) } }),
  };
}

function conditionOf(condition: FormCondition): JsonSchema {
  return {
    scope: scopeOf(condition.field),
    schema: 'equals' in condition ? { const: condition.equals } : { enum: [...condition.in] },
  };
}

function requiredWhen(field: FieldBlock<FormBlock>, condition: FormCondition): JsonSchema {
  const name = lastSegment(condition.field);
  const matching = 'equals' in condition ? { const: condition.equals } : { enum: [...condition.in] };

  return { if: { properties: { [name]: matching }, required: [name] }, then: { required: [lastSegment(field.name)] } };
}

/** The fields of one level of the body, whatever group of the layout holds them. */
function fieldsOf(blocks: readonly FormBlock[]): FieldBlock<FormBlock>[] {
  return blocks.flatMap((block) => (block.type === 'group' ? fieldsOf(block.blocks) : [block]));
}

function scopeOf(path: string): string {
  return `#/properties/${path.split('.').join('/properties/')}`;
}

function lastSegment(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1);
}
