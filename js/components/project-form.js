import { accentAttributes } from './accent.js';
import { CUSTOM_PROJECT_TYPE, DEFAULT_PROJECT_TYPE, PROJECT_TYPES } from '../data/project-types.js';
import { PROJECT_COLORS } from '../data/project-colors.js';
import { escapeHtml } from '../utils/helpers.js';

const NAME_MAX_LENGTH = 80;
const CUSTOM_TYPE_MAX_LENGTH = 30;

function renderTypeOptions(selectedType) {
  return PROJECT_TYPES.map(
    (type) => `
      <label class="type-option">
        <input class="type-option__input" type="radio" name="type" value="${type.id}" ${type.id === selectedType ? 'checked' : ''} />
        <span class="type-option__label">${type.label}</span>
      </label>`,
  ).join('');
}

function renderColorOptions(selectedColor) {
  return PROJECT_COLORS.map(
    (color) => `
      <label class="color-option" ${accentAttributes(color.value)}>
        <input class="color-option__input" type="radio" name="color" value="${color.id}"
          aria-label="${color.label}" ${color.id === selectedColor ? 'checked' : ''} />
        <span class="color-option__swatch" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </span>
      </label>`,
  ).join('');
}

/**
 * @param {object} options
 * @param {object} options.values  { name, type, customTypeLabel, color }
 */
export function renderProjectForm({ values, submitLabel, lead }) {
  const selectedType = values.type ?? DEFAULT_PROJECT_TYPE;

  return `
    <form class="form" novalidate data-project-form>
      ${lead ? `<p class="form__lead">${escapeHtml(lead)}</p>` : ''}

      <div class="field">
        <label class="field__label" for="project-name">اسم المشروع</label>
        <input class="input" id="project-name" name="name" type="text" autocomplete="off"
          maxlength="${NAME_MAX_LENGTH}" placeholder="مثال: العادات الذرية"
          value="${escapeHtml(values.name ?? '')}" aria-describedby="project-name-error" autofocus />
        <p class="field__error" id="project-name-error" hidden></p>
      </div>

      <fieldset class="field">
        <legend class="field__label">نوع المشروع</legend>
        <div class="type-picker">${renderTypeOptions(selectedType)}</div>
      </fieldset>

      <div class="field field--reveal" data-custom-type-field ${selectedType === CUSTOM_PROJECT_TYPE ? '' : 'hidden'}>
        <label class="field__label" for="project-custom-type">اسم نوع المشروع</label>
        <input class="input" id="project-custom-type" name="customTypeLabel" type="text" autocomplete="off"
          maxlength="${CUSTOM_TYPE_MAX_LENGTH}" placeholder="مثال: ورشة عمل، محاضرة، مقال"
          value="${escapeHtml(values.customTypeLabel ?? '')}" aria-describedby="project-custom-type-error" />
        <p class="field__error" id="project-custom-type-error" hidden></p>
      </div>

      <fieldset class="field">
        <legend class="field__label">لون المشروع</legend>
        <div class="color-picker">${renderColorOptions(values.color)}</div>
      </fieldset>

      <div class="form-footer">
        <button type="submit" class="btn btn--primary btn--lg">${escapeHtml(submitLabel)}</button>
        <button type="button" class="btn btn--ghost btn--lg" data-modal-close>إلغاء</button>
      </div>
    </form>`;
}

function setFieldError(input, message) {
  const error = document.getElementById(input.getAttribute('aria-describedby'));
  input.setAttribute('aria-invalid', String(Boolean(message)));
  error.textContent = message ?? '';
  error.hidden = !message;
}

export function bindProjectForm(form, { onSubmit }) {
  const { name: nameInput, customTypeLabel: customTypeInput } = form.elements;
  const customTypeField = form.querySelector('[data-custom-type-field]');
  const isCustomType = () => form.elements.type.value === CUSTOM_PROJECT_TYPE;

  form.addEventListener('input', (event) => {
    if (event.target === nameInput || event.target === customTypeInput) setFieldError(event.target, null);
  });

  form.addEventListener('change', (event) => {
    if (event.target.name !== 'type') return;
    customTypeField.hidden = !isCustomType();
    if (isCustomType()) customTypeInput.focus();
    else setFieldError(customTypeInput, null);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const customTypeLabel = isCustomType() ? customTypeInput.value.trim() : null;

    if (!name) {
      setFieldError(nameInput, 'اكتب اسمًا للمشروع');
      nameInput.focus();
      return;
    }
    if (isCustomType() && !customTypeLabel) {
      setFieldError(customTypeInput, 'اكتب اسمًا لنوع المشروع');
      customTypeInput.focus();
      return;
    }

    onSubmit({ name, type: form.elements.type.value, customTypeLabel, color: form.elements.color.value });
  });
}
