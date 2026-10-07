import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Built on the native <dialog>, which provides focus trapping, inert
 * background, and focus restoration on close. Put `data-autofocus` on the
 * element that should receive focus when the dialog opens.
 */
export function Modal({
  title,
  onClose,
  variant,
  children,
}: {
  title: string;
  onClose: () => void;
  variant?: 'compact';
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    // Closing (not just removing) lets the browser restore focus to the opener.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={variant ? `modal modal--${variant}` : 'modal'}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the dialog element itself means the backdrop was clicked.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal__panel">
        <header className="modal__header">
          <h2 className="modal__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="icon-btn modal__close" aria-label="إغلاق" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </dialog>
  );
}
