import { getProjectColor } from '../data/project-colors.js';

/**
 * Attributes that scope an accent color to an element. CSS derives soft and
 * strong tints from `--accent` (see variables.css → [data-accent]).
 */
export function accentAttributes(color) {
  return `data-accent style="--accent: ${color}"`;
}

/** The project's chosen color, applied as the accent for everything inside. */
export function projectAccent(project) {
  return accentAttributes(getProjectColor(project));
}
