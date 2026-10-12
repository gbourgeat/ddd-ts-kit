import type { OpenApiConfig, OpenApiDocumentConfig } from './config.js';
import { isRecord } from './values/is-record.js';
import { strings } from './values/strings.js';
import { text } from './values/text.js';

/** Tolerant: a wrong format or a document without a name is kept as written, and `config/valid` reports it. */
export function parseOpenApi(value: unknown): OpenApiConfig {
  const raw = isRecord(value) ? value : {};
  const documents: unknown[] = Array.isArray(raw['documents']) ? raw['documents'] : [];

  return { format: text(raw['format'], 'yaml'), documents: documents.filter(isRecord).map(parseDocument) };
}

function parseDocument(raw: Record<string, unknown>): OpenApiDocumentConfig {
  const title = raw['title'];

  return {
    name: text(raw['name'], ''),
    ...(typeof title === 'string' && title !== '' ? { title } : {}),
    groups: strings(raw['groups'], []),
    contexts: strings(raw['contexts'], []),
    tags: strings(raw['tags'], []),
  };
}
