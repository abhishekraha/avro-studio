import type { LinkType } from '../../core/types/linkage';

export type DisplayFieldStatus = 'identical' | 'renamed' | 'modified' | 'added' | 'moved' | 'deleted';

export function displayFieldStatus(status?: LinkType | 'unchanged'): DisplayFieldStatus {
  if (!status || status === 'unchanged' || status === 'identical') return 'identical';
  // Rename / type-change takes precedence over move
  if (status === 'renamed' || status === 'moved-renamed' || status === 'type-changed') return 'renamed';
  if (status === 'moved') return 'moved';
  if (status === 'added') return 'added';
  if (status === 'deleted') return 'deleted';
  return 'modified';
}

export function fieldStatusLabel(status?: LinkType | 'unchanged'): string {
  return displayFieldStatus(status).toUpperCase();
}
