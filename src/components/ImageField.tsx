import { useRef, useState, type DragEvent } from 'react';
import { ACCEPTED_IMAGE_TYPES, ImageFileError, prepareImageFile } from '../lib/image-file';
import { Icon } from './Icon';

/**
 * Pick an image from the device (click or drag & drop), with a preview and a
 * way to replace or remove it. The value is the processed image's data URL.
 */
export function ImageField({
  id,
  value,
  describedBy,
  invalid,
  onChange,
  onError,
}: {
  id: string;
  value: string;
  describedBy: string;
  invalid: boolean;
  onChange: (dataUrl: string) => void;
  onError: (message: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    onError(undefined);
    try {
      onChange(await prepareImageFile(file));
    } catch (error) {
      onError(error instanceof ImageFileError ? error.message : 'تعذّر تجهيز الصورة.');
    } finally {
      setBusy(false);
      // Allow picking the same file again after removing it.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  };

  return (
    <div className={`image-field${value ? ' has-image' : ''}`}>
      <input
        ref={inputRef}
        className="image-field__input"
        id={id}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {value ? (
        <div className="image-field__preview">
          <img src={value} alt="معاينة الصورة المختارة" />
          <div className="image-field__actions">
            <label htmlFor={id} className="btn btn--secondary">
              <Icon name="upload" size={16} />
              تغيير الصورة
            </label>
            <button type="button" className="btn btn--ghost" onClick={() => onChange('')}>
              <Icon name="trash" size={16} />
              إزالة
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`image-field__dropzone${dragging ? ' is-dragging' : ''}${invalid ? ' is-invalid' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <Icon name={busy ? 'image' : 'upload'} size={24} />
          <span className="image-field__title">{busy ? 'جارٍ تجهيز الصورة…' : 'اختر صورة من جهازك'}</span>
          <span className="image-field__meta">أو اسحبها إلى هنا · PNG، JPG، WebP، GIF، SVG</span>
        </label>
      )}
    </div>
  );
}
