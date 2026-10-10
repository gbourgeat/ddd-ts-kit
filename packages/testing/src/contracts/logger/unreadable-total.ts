/** An object whose only field throws when it is read. */
export function unreadableTotal(): { readonly total: number } {
  return {
    get total(): number {
      throw new Error('unreadable');
    },
  };
}
