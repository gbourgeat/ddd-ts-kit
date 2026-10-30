import fs from 'node:fs';
import path from 'node:path';
import { jsonObject } from '../init/json-object';
import { isRecord } from '../init/is-record';
import { AGENT_FILE } from './agent-file';
import type { AgentRecord } from './worker-progress';

/** The most said of what the guard found left outside the scope: the report of the worker holds the rest. */
const OUTSIDE_LIMIT = 600;

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
  if (!isRecord(value) || typeof value['at'] !== 'string') {
    return null;
  }

  const outside = value['outside'];

  return {
    at: value['at'],
    reportCurrent: value['reportCurrent'] === true,
    ...(typeof outside === 'string' ? { outside: oneLine(outside) } : {}),
  };
}

/** A text of the worktree, said to the conductor as data: one line, cut. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, OUTSIDE_LIMIT);
}
