import { isRecord } from './values/is-record.js';

/** Changes the config text through its JSON value, so that what the user wrote elsewhere keeps its shape. */
export function editConfigText(content: string, edit: (raw: Record<string, unknown>) => void): string {
  const raw: unknown = JSON.parse(content);

  if (!isRecord(raw)) return content;

  edit(raw);

  return `${JSON.stringify(raw, null, 2)}\n`;
}
