import { isRecord } from './is-record';

/** The emitted map, naming the real file and holding its text, for stack traces and coverage. */
export function sourceMapOf(emitted: string, file: string, code: string): string {
  const map: unknown = JSON.parse(emitted);
  const { mappings, names } = isRecord(map) ? map : {};

  return JSON.stringify({
    version: 3,
    sources: [file],
    sourcesContent: [code],
    names: names ?? [],
    mappings: mappings ?? '',
  });
}
