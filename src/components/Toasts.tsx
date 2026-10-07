import { useEffect, useState } from 'react';
import { useUiStore, type Toast } from '../store/ui-store';
import { Icon } from './Icon';

const VISIBLE_MS = 2800;
const ERROR_VISIBLE_MS = 6000;
const LEAVE_FALLBACK_MS = 400;

function ToastMessage({ toast }: { toast: Toast }) {
  const dismissToast = useUiStore((state) => state.dismissToast);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), toast.tone === 'error' ? ERROR_VISIBLE_MS : VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [toast.tone]);

  // Fallback for when animations are disabled and `animationend` never fires.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => dismissToast(toast.id), LEAVE_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, dismissToast, toast.id]);

  return (
    <p
      className={`toast toast--${toast.tone}${leaving ? ' is-leaving' : ''}`}
      role={toast.tone === 'error' ? 'alert' : undefined}
      onAnimationEnd={() => leaving && dismissToast(toast.id)}
    >
      <Icon name={toast.tone === 'error' ? 'info' : 'check'} size={18} />
      {toast.message}
    </p>
  );
}

/** Subtle, self-dismissing confirmations, announced to screen readers. */
export function Toasts() {
  const toasts = useUiStore((state) => state.toasts);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
