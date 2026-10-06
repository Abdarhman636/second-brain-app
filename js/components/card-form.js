/*
 * Card form, shared by "create" and "edit". The content fields are generated
 * from the card type definition, and switching type keeps whatever the user
 * already typed in fields with the same name.
 */
import { icon } from './icons.js';
import { CARD_TYPE_ORDER, getCardType } from '../data/card-types.js';
import { escapeHtml } from '../utils/helpers.js';

const REQUIRED_MESSAGE = 'هذا الحقل مطلوب';
const PROJECT_REQUIRED_MESSAGE = 'اختر المشروع الذي تنتمي إليه البطاقة';
const SUBMIT_MODIFIER = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

function renderContentFields(typeId, content, { autofocus = false } = {}) {
  return getCardType(typeId)
    .fields.map((field, index) => {
      const id = `card-field-${field.name}`;
      const value = escapeHtml(content[field.name] ?? '');
      const common = `id="${id}" name="${field.name}" placeholder="${escapeHtml(field.placeholder)}"
        aria-describedby="${id}-error" ${autofocus && index === 0 ? 'autofocus' : ''}`;

      const control =
        field.control === 'textarea'
          ? `<textarea class="textarea" rows="${field.rows ?? 4}" ${common}>${value}</textarea>`
          : `<input class="input" type="text" autocomplete="off" value="${value}" ${common} />`;

      return `
        <div class="field">
          <label class="field__label" for="${id}">${field.label}</label>
          ${control}
          <p class="field__error" id="${id}-error" hidden></p>
        </div>`;
    })
    .join('');
}

function renderTypeOptions(selectedType) {
  return CARD_TYPE_ORDER.map((typeId) => {
    const type = getCardType(typeId);
    return `
      <label class="segmented__option">
        <input class="segmented__input" type="radio" name="type" value="${type.id}" ${type.id === selectedType ? 'checked' : ''} />
        <span class="segmented__label">${icon(type.icon, { size: 18 })}${type.label}</span>
      </label>`;
  }).join('');
}

/**
 * @param {object} options
 * @param {{projectId: string, type: string, content: object}} options.values
 * @param {Array} options.projects
 * @param {string} options.submitLabel
 */
export function renderCardForm({ values, projects, submitLabel }) {
  // Without a project in context (e.g. quick add from the dashboard) the user picks one explicitly.
  const placeholder = values.projectId ? '' : '<option value="" disabled selected>اختر المشروع</option>';
  const projectOptions = projects
    .map(
      (project) =>
        `<option value="${escapeHtml(project.id)}" ${project.id === values.projectId ? 'selected' : ''}>${escapeHtml(project.name)}</option>`,
    )
    .join('');

  return `
    <form class="form" novalidate data-card-form>
      <div class="field">
        <label class="field__label" for="card-project">المشروع</label>
        <select class="select" id="card-project" name="projectId" aria-describedby="card-project-error">${placeholder}${projectOptions}</select>
        <p class="field__error" id="card-project-error" hidden></p>
      </div>

      <fieldset class="field">
        <legend class="field__label">نوع البطاقة</legend>
        <div class="segmented">${renderTypeOptions(values.type)}</div>
      </fieldset>

      <div class="form__group" data-card-fields>
        ${renderContentFields(values.type, values.content, { autofocus: true })}
      </div>

      <div class="form-footer">
        <button type="submit" class="btn btn--primary btn--lg">${escapeHtml(submitLabel)}</button>
        <button type="button" class="btn btn--ghost btn--lg" data-modal-close>إلغاء</button>
        <span class="form-footer__hint"><span dir="ltr"><kbd>${SUBMIT_MODIFIER}</kbd> + <kbd>Enter</kbd></span> للحفظ</span>
      </div>
    </form>`;
}

function setFieldError(form, fieldName, message) {
  const input = form.elements[fieldName];
  const error = input && document.getElementById(input.getAttribute('aria-describedby'));
  if (!input || !error) return;

  input.setAttribute('aria-invalid', String(Boolean(message)));
  error.textContent = message ?? '';
  error.hidden = !message;
}

export function bindCardForm(form, { values, onSubmit }) {
  const fieldsContainer = form.querySelector('[data-card-fields]');
  const draft = { ...values.content };
  let currentType = values.type;

  const currentFields = () => getCardType(currentType).fields;

  const captureDraft = () => {
    currentFields().forEach(({ name }) => {
      draft[name] = form.elements[name]?.value ?? '';
    });
  };

  form.addEventListener('change', (event) => {
    if (event.target.name === 'projectId') setFieldError(form, 'projectId', null);
    if (event.target.name !== 'type') return;
    captureDraft();
    currentType = event.target.value;
    fieldsContainer.innerHTML = renderContentFields(currentType, draft);
  });

  form.addEventListener('input', (event) => {
    if (event.target.getAttribute('aria-invalid') === 'true') setFieldError(form, event.target.name, null);
  });

  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    captureDraft();

    const fields = currentFields();
    const content = Object.fromEntries(fields.map(({ name }) => [name, (draft[name] ?? '').trim()]));
    const missing = fields.filter(({ name }) => !content[name]);

    const projectId = form.elements.projectId.value;
    setFieldError(form, 'projectId', projectId ? null : PROJECT_REQUIRED_MESSAGE);
    fields.forEach(({ name }) => setFieldError(form, name, missing.some((field) => field.name === name) ? REQUIRED_MESSAGE : null));

    if (!projectId) {
      form.elements.projectId.focus();
      return;
    }
    if (missing.length) {
      form.elements[missing[0].name].focus();
      return;
    }

    onSubmit({ projectId, type: currentType, content });
  });
}
