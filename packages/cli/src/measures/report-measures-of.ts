import { sectionOf } from '../stories/section-of.js';
import type { ReportMeasures } from './report-measures.js';
import { subsectionOf } from './subsection-of.js';

const DECISION = /^\s*[-*]\s+\**D\d+\b/;
const ITEM = /^\s*[-*]\s+\S/;
const INCIDENT = /incidents\/([\w.-]+\.md)/;
const INTENT = /intents\/[\w.-]+\.md/;
const TICKET = /\b[A-Z][A-Z0-9]+-\d+\b|(?<![\w.])#\d+\b|https?:\/\//;

/** The decisions, the compromises, the verification and the origin a story file states. */
export function reportMeasuresOf(story: string): ReportMeasures {
  const report = sectionOf(story, 'Report') ?? '';
  const origin = sectionOf(story, 'Origin') ?? '';

  return {
    decisions: story.split('\n').filter((line) => DECISION.test(line)).length,
    compromises: (subsectionOf(report, 'Compromises') ?? '').split('\n').filter((line) => ITEM.test(line)).length,
    verification: (subsectionOf(report, 'Verification') ?? '').includes('npm run verify'),
    ...originOf(origin),
  };
}

function originOf(origin: string): Pick<ReportMeasures, 'origin' | 'incident'> {
  const incident = INCIDENT.exec(origin)?.[1];

  if (incident !== undefined) {
    return { origin: 'incident', incident: `docs/architecture/incidents/${incident}` };
  }

  if (INTENT.test(origin)) {
    return { origin: 'intent' };
  }

  return TICKET.test(origin) ? { origin: 'ticket' } : {};
}
