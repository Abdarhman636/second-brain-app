import type { Project, ProjectColorId } from './types';

/*
 * The ten project accent colors. All are desaturated mid-tones that read
 * clearly on both the light and the dark theme. Projects store the color
 * `id`, so the palette can be retuned without migrating data.
 */
export const PROJECT_COLORS: readonly { id: ProjectColorId; label: string; value: string }[] = [
  { id: 'graphite', label: 'رمادي', value: '#5c5c5c' },
  { id: 'clay', label: 'بني', value: '#a5764d' },
  { id: 'terracotta', label: 'طوبي', value: '#b56b56' },
  { id: 'rose', label: 'وردي', value: '#a8657a' },
  { id: 'plum', label: 'بنفسجي', value: '#8467a0' },
  { id: 'blue', label: 'أزرق', value: '#4a7c9c' },
  { id: 'teal', label: 'فيروزي', value: '#3a8481' },
  { id: 'sage', label: 'أخضر', value: '#58866a' },
  { id: 'olive', label: 'زيتوني', value: '#7d8442' },
  { id: 'ochre', label: 'خردلي', value: '#a3863a' },
];

const FALLBACK_COLOR = PROJECT_COLORS[0]!;

export function getProjectColor(project: Pick<Project, 'color'> | undefined): string {
  return (PROJECT_COLORS.find((color) => color.id === project?.color) ?? FALLBACK_COLOR).value;
}

/** Suggest the first color no existing project uses yet, so new projects stay distinct. */
export function suggestProjectColor(projects: readonly Pick<Project, 'color'>[]): ProjectColorId {
  const used = new Set(projects.map((project) => project.color));
  return (PROJECT_COLORS.find((color) => !used.has(color.id)) ?? FALLBACK_COLOR).id;
}
