import type { AgentRecord, NextStep, WorkerProgress } from './worker-progress';

/** What decides the next step of the conductor for one worker. */
export interface StepFacts {
  readonly phase: WorkerProgress['phase'];
  readonly agent: AgentRecord | null;
  /** A new agent is asked for whatever the last one did. */
  readonly fresh: boolean;
  /** The agent's last run committed or changed a file of the slice. */
  readonly progressed: boolean;
  /** No file of the slice is left uncommitted. */
  readonly clean: boolean;
  /** The conductor knows the agent stopped: a recent tool call does not mean it still works. */
  readonly stopped: boolean;
}

/** An agent seen this recently, and not stopped since, is still working. */
const WORKING_MINUTES = 3;
/** Past this many runs on one worktree, a resumed agent has shown it does not get through. */
const MAX_RUNS = 3;

/**
 * What the conductor does next for a worker: merge once every row is committed and nothing is
 * left; wait while its agent works (a stop at the turn limit runs no hook: only the time since
 * its last tool call, or the conductor's word, tells it stopped); resume that agent with SendMessage when it stopped mid-row
 * after progress in a run that is not its third (it keeps its history, a new agent rereads
 * everything); otherwise a new agent with the resume briefing.
 */
export function nextStepOf(facts: StepFacts): NextStep {
  const { phase, agent } = facts;

  if (phase === 'rows committed' && facts.clean) {
    return { action: 'merge' };
  }

  if (agent !== null && !facts.stopped && isWorking(agent)) {
    return { action: 'wait' };
  }

  return agent !== null && isResumable(agent, facts)
    ? { action: 'send-message', to: agent.agentId }
    : { action: 'new-agent' };
}

function isResumable(agent: AgentRecord, facts: StepFacts): boolean {
  return !facts.fresh && facts.phase === 'mid-row' && agent.run < MAX_RUNS && facts.progressed;
}

function isWorking(agent: AgentRecord): boolean {
  const seen = Date.parse(agent.lastSeen);
  const stopped = agent.lastStop === null ? Number.NEGATIVE_INFINITY : Date.parse(agent.lastStop.at);

  return Date.now() - seen < WORKING_MINUTES * 60_000 && stopped < seen;
}
