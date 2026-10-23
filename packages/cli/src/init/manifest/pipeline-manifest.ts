import { readTemplate } from '../../templating';
import { isRecord } from '../is-record';

/** The `ci:*` scripts and the analyzers they need, as the pipeline ships them. */
export interface PipelineManifest {
  readonly scripts: Record<string, string>;
  readonly devDependencies: Record<string, string>;
}

export function pipelineManifest(): PipelineManifest {
  const parsed: unknown = JSON.parse(readTemplate('pipeline/package-scripts.json'));

  const part = (key: string): Record<string, string> => {
    const value: unknown = isRecord(parsed) ? parsed[key] : undefined;

    return isRecord(value)
      ? Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, String(entry)]))
      : {};
  };

  return { scripts: part('scripts'), devDependencies: part('devDependencies') };
}
