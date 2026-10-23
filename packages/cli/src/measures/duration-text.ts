/** `3d 2h`, `5h`, `0.5h`, or `open` when the end has not happened. */
export function durationText(hours: number | undefined): string {
  if (hours === undefined) {
    return 'open';
  }

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);

  return rest === 0 ? `${days}d` : `${days}d ${rest}h`;
}
