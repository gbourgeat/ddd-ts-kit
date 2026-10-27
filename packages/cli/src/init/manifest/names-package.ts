/** Whether a key of an allow list names the package: by name alone, or with its versions (`name@1.2.3`, `name@1.2.3 || 1.2.4`). */
export function namesPackage(key: string, name: string): boolean {
  return key === name || key.startsWith(`${name}@`);
}
