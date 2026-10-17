/**
 * The code of the story or milestone a row belongs to: its id without the last `.<number>`
 * (`M1` for `M1.03`, `US5` for `US5.12`), as the plan-slices skill numbers the rows. Undefined for
 * an id without that number (`12`, `M1`): such a row belongs to no story.
 */
export function storyOf(id: string): string | undefined {
  return /^(.+)\.\d+$/.exec(id)?.[1];
}
