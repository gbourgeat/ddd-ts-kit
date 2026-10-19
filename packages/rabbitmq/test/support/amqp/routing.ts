export function routes(type: string, pattern: string, routingKey: string): boolean {
  if (type === 'fanout') {
    return true;
  }

  return type === 'topic' ? topicMatches(pattern.split('.'), routingKey.split('.')) : pattern === routingKey;
}

/** `*` stands for one word, `#` for zero or more. */
function topicMatches(pattern: readonly string[], words: readonly string[]): boolean {
  const [head, ...rest] = pattern;

  if (head === undefined) {
    return words.length === 0;
  }

  if (head === '#') {
    return topicMatches(rest, words) || (words.length > 0 && topicMatches(pattern, words.slice(1)));
  }

  return words.length > 0 && (head === '*' || head === words[0]) && topicMatches(rest, words.slice(1));
}
