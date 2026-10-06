/*
 * Project types. A type describes what kind of source a project is; its
 * visual accent comes from the project's own color (see project-colors.js).
 * Choosing "أخرى" lets the user name the type themselves.
 */
export const PROJECT_TYPES = Object.freeze([
  { id: 'book', label: 'كتاب' },
  { id: 'podcast', label: 'بودكاست' },
  { id: 'course', label: 'كورس' },
  { id: 'curriculum', label: 'منهج دراسي' },
  { id: 'topic', label: 'موضوع' },
  { id: 'skill', label: 'مهارة' },
  { id: 'personal', label: 'ملاحظات شخصية' },
  { id: 'other', label: 'أخرى' },
]);

export const DEFAULT_PROJECT_TYPE = 'book';
export const CUSTOM_PROJECT_TYPE = 'other';

export function getProjectType(typeId) {
  return (
    PROJECT_TYPES.find((type) => type.id === typeId) ??
    PROJECT_TYPES.find((type) => type.id === CUSTOM_PROJECT_TYPE)
  );
}

/**
 * The type name to display for a project: the user's own name when the type
 * is "أخرى", otherwise the predefined label. May contain user text — escape it.
 */
export function getProjectTypeLabel(project) {
  if (project?.type === CUSTOM_PROJECT_TYPE && project.customTypeLabel) return project.customTypeLabel;
  return getProjectType(project?.type).label;
}
