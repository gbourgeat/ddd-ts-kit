import fs from 'node:fs';
import path from 'node:path';
import { jsonObject } from '../init/json-object.js';
import { isRecord } from '../init/is-record.js';
import { AGENT_FILE } from './agent-file.js';
import type { AgentRecord } from './worker-progress.js';

/** The agent the guard saw working in the project at `project`; null when it recorded none, or a file it cannot read. */
export function readAgentRecord(project: string): AgentRecord | null {
  const json = readJson(path.join(project, AGENT_FILE));
  const { agentId, run, lastSeen } = json;

  if (typeof agentId !== 'string' || typeof run !== 'number' || typeof lastSeen !== 'string') {
    return null;
  }

  return {
    agentId,
    run,
    runStartedAt: textOf(json['runStartedAt']) ?? lastSeen,
    runStartHead: textOf(json['runStartHead']),
    lastSeen,
    toolCalls: Number(json['toolCalls']) || 0,
    rowCosts: costsOf(json['rowCosts']),
    lastStop: stopOf(json['lastStop']),
  };
}

function readJson(file: string): Record<string, unknown> {
  return (fs.existsSync(file) ? jsonObject(fs.readFileSync(file, 'utf8')) : undefined) ?? {};
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function costsOf(value: unknown): Record<string, number> {
  return isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
      )
    : {};
}

function stopOf(value: unknown): AgentRecord['lastStop'] {
  return isRecord(value) && typeof value['at'] === 'string'
    ? { at: value['at'], reportCurrent: value['reportCurrent'] === true }
    : null;
}
