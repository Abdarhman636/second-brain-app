import { useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { PROJECT_COLORS } from '../domain/project-colors';
import { CUSTOM_PROJECT_TYPE, PROJECT_TYPES } from '../domain/project-types';
import { SHELF_NAME_MAX_LENGTH, sortShelves } from '../domain/shelves';
import type { ProjectInput, Shelf } from '../domain/types';

const NAME_MAX_LENGTH = 80;
const CUSTOM_TYPE_MAX_LENGTH = 30;

/** Select value for creating a shelf from the form. */
const NEW_SHELF = '__new';

type Errors = Partial<Record<'name' | 'customTypeLabel' | 'shelfName', string>>;

export function ProjectForm({
  initial,
  shelves,
  submitLabel,
  lead,
  onSubmit,
  onCancel,
}: {
  initial: ProjectInput;
  shelves: readonly Shelf[];
  submitLabel: string;
  lead?: string;
  /** `newShelfName` is set when the user named a new shelf for the project. */
  onSubmit: (input: ProjectInput, newShelfName: string | null) => void;
  onCancel: () => void;
}) {
  const idPrefix = useId();
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(initial.type);
  const [customTypeLabel, setCustomTypeLabel] = useState(initial.customTypeLabel ?? '');
  const [color, setColor] = useState(initial.color);
  const [shelfChoice, setShelfChoice] = useState(initial.shelfId ?? '');
  const [shelfName, setShelfName] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const customTypeRef = useRef<HTMLInputElement>(null);
  const shelfNameRef = useRef<HTMLInputElement>(null);

  const isCustomType = type === CUSTOM_PROJECT_TYPE;
  const isNewShelf = shelfChoice === NEW_SHELF;
  const ids = { name: `${idPrefix}-name`, customType: `${idPrefix}-custom-type`, shelf: `${idPrefix}-shelf`, shelfName: `${idPrefix}-shelf-name` };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedCustomType = customTypeLabel.trim();
    const trimmedShelfName = shelfName.trim();

    const nextErrors: Errors = {};
    if (!trimmedName) nextErrors.name = 'اكتب اسمًا للمشروع';
    else if (isCustomType && !trimmedCustomType) nextErrors.customTypeLabel = 'اكتب اسمًا لنوع المشروع';
    else if (isNewShelf && !trimmedShelfName) nextErrors.shelfName = 'اكتب اسمًا للرف';
    setErrors(nextErrors);

    if (nextErrors.name) return document.getElementById(ids.name)?.focus();
    if (nextErrors.customTypeLabel) return customTypeRef.current?.focus();
    if (nextErrors.shelfName) return shelfNameRef.current?.focus();

    onSubmit(
      {
        name: trimmedName,
        type,
        customTypeLabel: isCustomType ? trimmedCustomType : null,
        color,
        shelfId: isNewShelf ? null : shelfChoice || null,
      },
      isNewShelf ? trimmedShelfName : null,
    );
  };

  return (
    <form className="form" noValidate onSubmit={handleSubmit}>
      {lead && <p className="form__lead">{lead}</p>}

      <div className="field">
        <label className="field__label" htmlFor={ids.name}>
          اسم المشروع
        </label>
        <input
          className="input"
          id={ids.name}
          type="text"
          autoComplete="off"
          maxLength={NAME_MAX_LENGTH}
          placeholder="مثال: العادات الذرية"
          value={name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={`${ids.name}-error`}
          data-autofocus=""
          onChange={(event) => {
            setName(event.target.value);
            setErrors((current) => ({ ...current, name: undefined }));
          }}
        />
        <p className="field__error" id={`${ids.name}-error`} hidden={!errors.name}>
          {errors.name}
        </p>
      </div>

      <fieldset className="field">
        <legend className="field__label">نوع المشروع</legend>
        <div className="type-picker">
          {PROJECT_TYPES.map((option) => (
            <label key={option.id} className="type-option">
              <input
                className="type-option__input"
                type="radio"
                name={`${idPrefix}-type`}
                value={option.id}
                checked={type === option.id}
                onChange={() => {
                  setType(option.id);
                  setErrors((current) => ({ ...current, customTypeLabel: undefined }));
                  if (option.id === CUSTOM_PROJECT_TYPE) requestAnimationFrame(() => customTypeRef.current?.focus());
                }}
              />
              <span className="type-option__label">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {isCustomType && (
        <div className="field field--reveal">
          <label className="field__label" htmlFor={ids.customType}>
            اسم نوع المشروع
          </label>
          <input
            ref={customTypeRef}
            className="input"
            id={ids.customType}
            type="text"
            autoComplete="off"
            maxLength={CUSTOM_TYPE_MAX_LENGTH}
            placeholder="مثال: ورشة عمل، محاضرة، مقال"
            value={customTypeLabel}
            aria-invalid={Boolean(errors.customTypeLabel)}
            aria-describedby={`${ids.customType}-error`}
            onChange={(event) => {
              setCustomTypeLabel(event.target.value);
              setErrors((current) => ({ ...current, customTypeLabel: undefined }));
            }}
          />
          <p className="field__error" id={`${ids.customType}-error`} hidden={!errors.customTypeLabel}>
            {errors.customTypeLabel}
          </p>
        </div>
      )}

      <div className="field">
        <label className="field__label" htmlFor={ids.shelf}>
          الرف
        </label>
        <select
          className="select"
          id={ids.shelf}
          value={shelfChoice}
          onChange={(event) => {
            setShelfChoice(event.target.value);
            setErrors((current) => ({ ...current, shelfName: undefined }));
            if (event.target.value === NEW_SHELF) requestAnimationFrame(() => shelfNameRef.current?.focus());
          }}
        >
          <option value="">بدون رف</option>
          {sortShelves(shelves).map((shelf) => (
            <option key={shelf.id} value={shelf.id}>
              {shelf.name}
            </option>
          ))}
          <option value={NEW_SHELF}>+ رف جديد…</option>
        </select>
        <p className="field__hint">الرف يجمع مشاريع متشابهة، مثل رف «كتب» فيه مشروع لكل كتاب.</p>
      </div>

      {isNewShelf && (
        <div className="field field--reveal">
          <label className="field__label" htmlFor={ids.shelfName}>
            اسم الرف الجديد
          </label>
          <input
            ref={shelfNameRef}
            className="input"
            id={ids.shelfName}
            type="text"
            autoComplete="off"
            maxLength={SHELF_NAME_MAX_LENGTH}
            placeholder="مثال: كتب، كورسات، بودكاست"
            value={shelfName}
            aria-invalid={Boolean(errors.shelfName)}
            aria-describedby={`${ids.shelfName}-error`}
            onChange={(event) => {
              setShelfName(event.target.value);
              setErrors((current) => ({ ...current, shelfName: undefined }));
            }}
          />
          <p className="field__error" id={`${ids.shelfName}-error`} hidden={!errors.shelfName}>
            {errors.shelfName}
          </p>
        </div>
      )}

      <fieldset className="field">
        <legend className="field__label">لون المشروع</legend>
        <div className="color-picker">
          {PROJECT_COLORS.map((option) => (
            <label key={option.id} className="color-option" data-accent="" style={{ '--accent': option.value } as CSSProperties}>
              <input
                className="color-option__input"
                type="radio"
                name={`${idPrefix}-color`}
                value={option.id}
                aria-label={option.label}
                checked={color === option.id}
                onChange={() => setColor(option.id)}
              />
              <span className="color-option__swatch" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-footer">
        <button type="submit" className="btn btn--primary btn--lg">
          {submitLabel}
        </button>
        <button type="button" className="btn btn--ghost btn--lg" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </form>
  );
}
