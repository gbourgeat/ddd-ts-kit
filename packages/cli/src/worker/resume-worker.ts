import path from 'node:path';
import { CliError } from '../cli-error.js';
import { readConfig } from '../config/index.js';
import { findWorker, type WorkerChoice } from './find-worker.js';
import { progressOf } from './progress-of.js';
import { resumeBriefing } from './resume-briefing.js';
import { resumeMessage } from './resume-message.js';
import type { AgentRecord, NextStep, WorkerProgress } from './worker-progress.js';

/** What `worker-scope <context> --resume` is asked. */
export interface ResumeRequest extends WorkerChoice {
  /** A new agent whatever the last one did: its context was full (`Prompt is too long`). */
  readonly fresh: boolean;
}

/** How to resume a stopped worker: where it stands, and the message or the briefing to send. */
export interface WorkerResume {
  readonly context: string;
  readonly worktree: string;
  /** Absolute path of the project inside the worktree. */
  readonly root: string;
  readonly branch: string | undefined;
  readonly base: string | undefined;
  readonly progress: WorkerProgress;
  readonly next: NextStep;
  /** The message that resumes its agent, when it can be resumed. */
  readonly sendMessage: { readonly to: string; readonly message: string } | null;
  /** The briefing of a new agent; null once every row is committed. */
  readonly briefing: string | null;
  readonly notes: readonly string[];
}

/** An agent seen this recently may still be working: its stop notification says it is not. */
const RECENT_MINUTES = 3;

/**
 * Reads where the stopped worker of a context stands and writes what resumes it: the message to
 * its agent, and the briefing of a new one. Reads only: creates no worktree or branch, rewrites
 * no file. The conductor runs it on a stop notification, so a recent tool call does not mean
 * the agent still works; a note says when one is that recent.
 */
export function resumeWorker(root: string, request: ResumeRequest): WorkerResume {
  const worker = findWorker(root, request);
  const config = readConfig(worker.project).config;
  const progress = progressOf(worker.project, worker.scope, { stopped: true, fresh: request.fresh });

  if (progress === undefined) {
    throw new CliError(
      `The config of ${worker.project} cannot be read.`,
      'Run `npx ddd-ts-kit doctor` in the worktree.',
    );
  }

  const { next, agent } = progress;
  const base = worker.scope.base ?? 'origin/main';
  const message = resumeMessage(progress, { context: request.context, project: worker.project, base });

  return {
    context: request.context,
    worktree: worker.worktree,
    root: worker.project,
    branch: worker.branch,
    base: worker.scope.base,
    progress,
    next,
    sendMessage: next.action === 'send-message' ? { to: next.to, message } : null,
    briefing: resumeBriefing(progress, { worker, config, project: path.basename(root) }),
    notes:
      agent !== null && mayStillWork(agent)
        ? [`its agent called a tool at ${agent.lastSeen}: resume it only once its stop notification arrived.`]
        : [],
  };
}

/** Seen a moment ago, and not stopped on its own since. */
function mayStillWork(agent: AgentRecord): boolean {
  const seen = Date.parse(agent.lastSeen);
  const stopped = agent.lastStop === null ? 0 : Date.parse(agent.lastStop.at);

  return Date.now() - seen < RECENT_MINUTES * 60_000 && stopped < seen;
}
