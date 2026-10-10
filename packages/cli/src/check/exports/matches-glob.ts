/** True when `file` matches `glob`: `*` matches inside one path segment, `**` across segments. */
export function matchesGlob(glob: string, file: string): boolean {
  const pattern = glob
    .split(/(\*\*\/|\*\*|\*)/)
    .map((part) => {
      if (part === '**/') return '(?:.*/)?';
      if (part === '**') return '.*';

      return part === '*' ? '[^/]*' : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');

  return new RegExp(`^${pattern}$`).test(file);
}
