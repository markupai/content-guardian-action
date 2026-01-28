/**
 * Common string utilities.
 */

export const TONE_PLACEHOLDER = "None (keep tone unchanged)";

export function getToneValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === TONE_PLACEHOLDER) {
    return undefined;
  }
  return trimmed;
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function wrapInlineCode(value: string): string {
  const matches = value.match(/`+/g);
  const maxLength = matches ? Math.max(...matches.map((match) => match.length)) : 0;
  const fence = "`".repeat(maxLength + 1);
  const needsPadding =
    value.startsWith(" ") || value.endsWith(" ") || value.startsWith("`") || value.endsWith("`");
  const wrappedValue = needsPadding ? ` ${value} ` : value;
  return `${fence}${wrappedValue}${fence}`;
}

export function capitalizeLabel(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
