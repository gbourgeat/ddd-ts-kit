import type { CommitLimitProblem } from './commit-limit-problems.js';
import { OPENAPI_FORMATS } from './openapi-formats.js';
import { isRecord } from './values/is-record.js';
import { strings } from './values/strings.js';

const FILE_NAME = /^[a-z0-9][a-z0-9-]*$/;
const CRITERIA = ['groups', 'contexts', 'tags'] as const;

/** What the raw `openapi` value of a config says that the scripts would not do as written. */
export function openApiProblems(value: unknown, contexts: readonly string[]): CommitLimitProblem[] {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    return [
      {
        key: 'openapi',
        message: '"openapi" is not an object.',
        fix: 'Write it as { "format": "yaml" }, or remove it.',
      },
    ];
  }

  const format = value['format'];
  const documents = value['documents'];

  return [
    ...(format === undefined || OPENAPI_FORMATS.some((known) => known === format)
      ? []
      : [
          {
            key: 'format',
            message: `"openapi.format" is ${JSON.stringify(format)}: the contracts are written in YAML.`,
            fix: `Use one of: ${OPENAPI_FORMATS.join(', ')}.`,
          },
        ]),
    ...(documents === undefined ? [] : documentProblems(documents, contexts)),
  ];
}

function documentProblems(documents: unknown, contexts: readonly string[]): CommitLimitProblem[] {
  if (!Array.isArray(documents)) {
    return [
      {
        key: 'documents',
        message: '"openapi.documents" is not a list: the contract is one document.',
        fix: 'Write a list of { "name", "title", "groups", "contexts", "tags" }, or remove it.',
      },
    ];
  }

  const names = documents.map((entry) => (isRecord(entry) ? entry['name'] : undefined));

  return documents.flatMap((entry, index) => [
    ...nameProblems(names, index),
    ...(isRecord(entry) ? criteriaProblems(entry, contexts) : []),
  ]);
}

function nameProblems(names: readonly unknown[], index: number): CommitLimitProblem[] {
  const name = names[index];

  if (typeof name !== 'string' || !FILE_NAME.test(name)) {
    return [
      {
        key: 'documents',
        message: `The document ${index + 1} of "openapi.documents" has the name ${JSON.stringify(name)}: it names its file, openapi/<name>.yaml.`,
        fix: 'Give it a name in lower-case kebab-case: "public", "back-office".',
      },
    ];
  }

  return names.indexOf(name) === index
    ? []
    : [{ key: name, message: `Two documents are named "${name}".`, fix: 'Give each document its own name.' }];
}

function criteriaProblems(entry: Record<string, unknown>, contexts: readonly string[]): CommitLimitProblem[] {
  const key = typeof entry['name'] === 'string' ? entry['name'] : 'documents';
  const listed = CRITERIA.flatMap((criterion) => strings(entry[criterion], []));

  const unknown = strings(entry['contexts'], []).filter((name) => !contexts.includes(name));

  return [
    ...(listed.length > 0
      ? []
      : [
          {
            key,
            message: `The document "${key}" names no route group, context or tag: it would hold no route.`,
            fix: 'List what it holds under "groups" (route group classes), "contexts" or "tags".',
          },
        ]),
    ...unknown.map((name) => ({
      key,
      message: `The document "${key}" names the context ${JSON.stringify(name)}, which the config does not declare.`,
      fix: 'Name a context declared under "contexts".',
    })),
  ];
}
