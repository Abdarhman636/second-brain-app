import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  CARD_TYPE_ORDER,
  getCardType,
  toCardBody,
  type CardFieldName,
  type CardFieldValues,
} from '../domain/card-types';
import type { CardInput, CardType, Project } from '../domain/types';
import { Icon } from './Icon';
import { ImageField } from './ImageField';

const REQUIRED_MESSAGE = 'هذا الحقل مطلوب';
const PROJECT_REQUIRED_MESSAGE = 'اختر المشروع الذي تنتمي إليه البطاقة';
const IMAGE_REQUIRED_MESSAGE = 'اختر صورة للبطاقة';
const SUBMIT_MODIFIER = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

type Errors = Partial<Record<CardFieldName | 'projectId', string>>;

/**
 * Card form, shared by "create" and "edit". Fields come from the card type
 * definition; switching type keeps what was typed in same-named fields.
 */
export function CardForm({
  initial,
  projects,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { projectId: string; type: CardType; values: CardFieldValues };
  projects: readonly Project[];
  submitLabel: string;
  onSubmit: (input: CardInput) => void;
  onCancel: () => void;
}) {
  const idPrefix = useId();
  const [projectId, setProjectId] = useState(initial.projectId);
  const [type, setType] = useState<CardType>(initial.type);
  const [values, setValues] = useState<CardFieldValues>(initial.values);
  const [errors, setErrors] = useState<Errors>({});

  const fields = getCardType(type).fields;
  const fieldId = (name: string) => `${idPrefix}-${name}`;

  const updateValue = (name: CardFieldName, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed: CardFieldValues = Object.fromEntries(fields.map(({ name }) => [name, (values[name] ?? '').trim()]));

    const nextErrors: Errors = {};
    if (!projectId) nextErrors.projectId = PROJECT_REQUIRED_MESSAGE;
    fields.forEach(({ name, control }) => {
      if (!trimmed[name]) nextErrors[name] = control === 'image' ? IMAGE_REQUIRED_MESSAGE : REQUIRED_MESSAGE;
    });
    setErrors(nextErrors);

    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(fieldId(firstInvalid))?.focus();
      return;
    }
    onSubmit({ projectId, ...toCardBody(type, trimmed) });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  return (
    <form className="form" noValidate onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div className="field">
        <label className="field__label" htmlFor={fieldId('projectId')}>
          المشروع
        </label>
        <select
          className="select"
          id={fieldId('projectId')}
          value={projectId}
          aria-invalid={Boolean(errors.projectId)}
          aria-describedby={`${fieldId('projectId')}-error`}
          onChange={(event) => {
            setProjectId(event.target.value);
            setErrors((current) => ({ ...current, projectId: undefined }));
          }}
        >
          {/* Without a project in context, the user picks one explicitly. */}
          {!initial.projectId && (
            <option value="" disabled>
              اختر المشروع
            </option>
          )}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <p className="field__error" id={`${fieldId('projectId')}-error`} hidden={!errors.projectId}>
          {errors.projectId}
        </p>
      </div>

      <fieldset className="field">
        <legend className="field__label">نوع البطاقة</legend>
        <div className="segmented">
          {CARD_TYPE_ORDER.map((typeId) => {
            const definition = getCardType(typeId);
            return (
              <label key={typeId} className="segmented__option">
                <input
                  className="segmented__input"
                  type="radio"
                  name={`${idPrefix}-type`}
                  value={typeId}
                  checked={type === typeId}
                  onChange={() => {
                    setType(typeId);
                    setErrors((current) => ({ projectId: current.projectId }));
                  }}
                />
                <span className="segmented__label">
                  <Icon name={definition.icon} size={18} />
                  {definition.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="form__group">
        {fields.map((field, index) => {
          const id = fieldId(field.name);
          const describedBy = `${field.hint ? `${id}-hint ` : ''}${id}-error`;
          const value = values[field.name] ?? '';
          const invalid = Boolean(errors[field.name]);
          const common = {
            id,
            value,
            placeholder: field.placeholder,
            'aria-invalid': invalid,
            'aria-describedby': describedBy,
            'data-autofocus': index === 0 ? '' : undefined,
          };

          return (
            <div key={field.name} className="field">
              <label className="field__label" htmlFor={id}>
                {field.label}
              </label>
              {field.control === 'image' ? (
                <ImageField
                  id={id}
                  value={value}
                  describedBy={describedBy}
                  invalid={invalid}
                  onChange={(dataUrl) => updateValue(field.name, dataUrl)}
                  onError={(message) => setErrors((current) => ({ ...current, [field.name]: message }))}
                />
              ) : field.control === 'textarea' ? (
                <textarea className="textarea" rows={field.rows ?? 4} {...common} onChange={(event) => updateValue(field.name, event.target.value)} />
              ) : (
                <input className="input" type="text" autoComplete="off" {...common} onChange={(event) => updateValue(field.name, event.target.value)} />
              )}
              {field.hint && (
                <p className="field__hint" id={`${id}-hint`}>
                  {field.hint}
                </p>
              )}
              <p className="field__error" id={`${id}-error`} hidden={!errors[field.name]}>
                {errors[field.name]}
              </p>
            </div>
          );
        })}
      </div>

      <div className="form-footer">
        <button type="submit" className="btn btn--primary btn--lg">
          {submitLabel}
        </button>
        <button type="button" className="btn btn--ghost btn--lg" onClick={onCancel}>
          إلغاء
        </button>
        <span className="form-footer__hint">
          <span dir="ltr">
            <kbd>{SUBMIT_MODIFIER}</kbd> + <kbd>Enter</kbd>
          </span>{' '}
          للحفظ
        </span>
      </div>
    </form>
  );
}
