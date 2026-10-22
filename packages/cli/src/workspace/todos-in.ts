import type { TodoLocation } from './todo-location';

const TODO_MARK = 'TODO(domain):';

/** The `TODO(domain)` lines of a file, each with where it is. */
export function todosIn(file: string, content: string): TodoLocation[] {
  return content.split('\n').flatMap((line, index) => {
    const at = line.indexOf(TODO_MARK);

    return at === -1 ? [] : [{ file, line: index + 1, text: cleanTodo(line.slice(at + TODO_MARK.length)) }];
  });
}

function cleanTodo(text: string): string {
  return text.replace(/['"`]?\)?;?\s*$/, '').trim();
}
