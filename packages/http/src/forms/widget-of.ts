import type { SchemaNode } from '../schema/schema-node.js';
import type { Widget } from './widget.js';

const BY_FORMAT: Readonly<Record<string, Widget>> = {
  'date-time': 'datetime',
  date: 'date',
  time: 'time',
  email: 'email',
};

/** The widget a field gets when its hint names none, from its schema. */
export function widgetOf(node: SchemaNode): Widget {
  if (node.node['enum'] !== undefined) {
    return 'select';
  }

  const type = node.type();

  if (type === 'boolean') {
    return 'checkbox';
  }

  if (type === 'number' || type === 'integer') {
    return 'number';
  }

  if (type === 'array') {
    return 'list';
  }

  const format = node.node['format'];

  return (typeof format === 'string' ? BY_FORMAT[format] : undefined) ?? 'text';
}
