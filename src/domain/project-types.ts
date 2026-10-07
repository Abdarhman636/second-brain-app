import type { Project, ProjectTypeId } from './types';

/*
 * Project types. A type describes what kind of source a project is; its
 * visual accent comes from the project's own color (see project-colors.ts).
 * Choosing "أخرى" lets the user name the type themselves.
 */
export const PROJECT_TYPES: readonly { id: ProjectTypeId; label: string }[] = [
  { id: 'book', label: 'كتاب' },
  { id: 'podcast', label: 'بودكاست' },
  { id: 'course', label: 'كورس' },
  { id: 'curriculum', label: 'منهج دراسي' },
  { id: 'topic', label: 'موضوع' },
  { id: 'skill', label: 'مهارة' },
  { id: 'personal', label: 'ملاحظات شخصية' },
  { id: 'other', label: 'أخرى' },
];

export const DEFAULT_PROJECT_TYPE: ProjectTypeId = 'book';
export const CUSTOM_PROJECT_TYPE: ProjectTypeId = 'other';

export function getProjectTypeLabel(project: Pick<Project, 'type' | 'customTypeLabel'>): string {
  if (project.type === CUSTOM_PROJECT_TYPE && project.customTypeLabel) return project.customTypeLabel;
  return PROJECT_TYPES.find((type) => type.id === project.type)?.label ?? 'أخرى';
}
