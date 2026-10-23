import { beforeAll, describe, expect, it } from 'vitest';
import type { MeasuresView } from '../src/measures/measures-view.js';
import { measuredStories, measuresOf, storyOf, US5 } from './support/measured-stories.js';

let root: string;

const measures = (...args: string[]): MeasuresView => measuresOf(root, ...args);

beforeAll(() => {
  root = measuredStories();
});

describe('ddd-ts-kit measures: one story from its first commit to its merge', () => {
  it('reads the design, build and lead times from the commits of the story file, its lock, its report and its merge', () => {
    const us5 = storyOf(measures(), 'US5');

    expect(us5).toMatchObject({
      file: US5,
      opened: '2026-03-01T09:00:00.000Z',
      designHours: 24,
      buildHours: 72,
      leadHours: 120,
    });

    expect(us5.merged).toMatch(/^[0-9a-f]{7}$/);
    expect(us5.author).toBeUndefined();
  });

  it('counts the criteria changed after the build started, the amendments of the lock, the decisions, the compromises and the verification', () => {
    const us5 = storyOf(measures(), 'US5');

    expect(us5.rework).toEqual({ criteriaChanges: 1, amendments: 1, refusals: 0 });
    expect(us5.decisions).toBe(2);
    expect(us5.compromises).toBe(2);
    expect(us5.verification).toBe(true);
    expect(us5.origin).toBe('ticket');
  });

  it('counts the TODO(review) markers its commits wrote and removed, and the remark another story repeats', () => {
    const us5 = storyOf(measures(), 'US5');

    expect(us5.review).toEqual({
      settled: 1,
      opened: 1,
      findings: {},
      repeats: ['language/glossary-term', 'name the total after its term'],
    });

    expect(us5.overlaps).toEqual(['US6']);
  });
});

describe('ddd-ts-kit measures: a story still open, from an incident', () => {
  it('leaves its times open, reads its findings by pass, its refusal, and the earlier incident its origin repeats', () => {
    const us6 = storyOf(measures(), 'US6');

    expect(us6.designHours).toBeUndefined();
    expect(us6.buildHours).toBeUndefined();
    expect(us6.leadHours).toBeUndefined();
    expect(us6.rework).toEqual({ criteriaChanges: 0, amendments: 0, refusals: 1 });
    expect(us6.review.findings).toEqual({ bugs: 2, security: 1 });
    expect(us6.review.settled).toBe(0);
    expect(us6.origin).toBe('incident');
    expect(us6.repeatIncident).toBe('docs/architecture/incidents/inc-1.md');
    expect(us6.verification).toBe(false);
    expect(us6.overlaps).toEqual(['US5']);
  });

  it('sums the period as medians and shares, and says what the platform alone knows', () => {
    const view = measures();

    expect(view.branch).toBe('main');
    expect(view.since).toBeUndefined();
    expect(view.byAuthor).toBeUndefined();

    expect(view.summary).toEqual({
      stories: 2,
      closed: 1,
      medianDesignHours: 24,
      medianBuildHours: 72,
      medianLeadHours: 120,
      medianCriteriaChanges: 0.5,
      medianDecisions: 1,
      medianCompromises: 1,
      medianSettled: 0.5,
      verified: 1,
      withOrigin: 2,
      parallel: 2,
      repeats: ['language/glossary-term', 'name the total after its term'],
      repeatIncidents: 1,
    });

    expect(view.notComputed).toEqual([
      'time to first review and first-run CI status come from the platform (its API is not read)',
    ]);
  });
});

describe('ddd-ts-kit measures: the period, one story and the authors', () => {
  it('keeps the stories opened since a day, one story alone, and names the authors on request only', () => {
    expect(measures('--since', '2026-03-02').stories.map((story) => story.story)).toEqual(['US6']);
    expect(measures('--since', '2026-03-02').since).toBe('2026-03-02');
    expect(measures('--story', 'us5').stories.map((story) => story.story)).toEqual(['US5']);
    expect(storyOf(measures('--story', 'US5'), 'US5').overlaps).toEqual([]);

    const authored = measures('--by-author');

    expect(authored.stories.map((story) => story.author)).toEqual(['Test', 'Test']);
    expect(authored.byAuthor).toEqual({ Test: { stories: 2, closed: 1, medianLeadHours: 120 } });
  });
});
