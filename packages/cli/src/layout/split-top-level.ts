import { nesting } from './nesting';

/** The elements of a list written on one line, split at the commas no bracket encloses. */
export function splitTopLevel(list: string): string[] {
  const depths = nesting(list);
  const items: string[] = [];
  let start = 0;

  for (const [index, char] of list.split('').entries()) {
    if (char === ',' && depths[index] === 0) {
      items.push(list.slice(start, index));
      start = index + 1;
    }
  }

  return [...items, list.slice(start)].map((item) => item.trim()).filter((item) => item !== '');
}
