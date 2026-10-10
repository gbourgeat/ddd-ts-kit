export function statusOf(stored: string): 'draft' | 'issued' {
  return stored === 'issued' ? 'issued' : 'draft';
}
