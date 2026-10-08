/*
 * Forgotten password, in two steps:
 *   /forgot-password  ask for a link by email
 *   /reset-password   the link signs the user in and lands here to choose a
 *                     new password (see PASSWORD_RECOVERY in data/session.ts)
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Icon } from '../components/Icon';
import { PASSWORD_MIN_LENGTH, requestPasswordReset, updatePassword } from '../data/session';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useAppStore } from '../store/app-store';
import { useSessionStore } from '../store/session-store';
import { useUiStore } from '../store/ui-store';
import { AuthShell, EMAIL_PATTERN, PasswordInput } from './AuthPage';

/** Focus the first field on wide screens (on phones the keyboard would hide the page). */
function useAutofocus() {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (window.matchMedia('(min-width: 721px)').matches) ref.current?.querySelector('input')?.focus();
  }, []);
  return ref;
}

export function ForgotPasswordPage() {
  useDocumentTitle('نسيت كلمة المرور');
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState('');
  const formRef = useAutofocus();

  const send = async (address: string) => {
    setBusy(true);
    const outcome = await requestPasswordReset(address);
    setBusy(false);
    return outcome;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setError(trimmed ? 'تأكد من صيغة البريد الإلكتروني' : 'اكتب بريدك الإلكتروني');
      document.getElementById('forgot-email')?.focus();
      return;
    }
    const outcome = await send(trimmed);
    if (outcome.error) setError(outcome.error);
    else setSentTo(trimmed);
  };

  const resend = async () => {
    if (!sentTo) return;
    setResendNote('جارٍ الإرسال…');
    const outcome = await send(sentTo);
    setResendNote(outcome.error ?? 'أرسلنا الرابط مرة أخرى.');
  };

  return (
    <AuthShell labelledBy="forgot-title">
      {sentTo ? (
        <div className="auth-confirm" role="status">
          <span className="auth-confirm__icon">
            <Icon name="check" size={22} />
          </span>
          <h1 className="auth-panel__title" id="forgot-title">
            تحقق من بريدك
          </h1>
          <p className="auth-panel__subtitle">
            إن كان <span dir="ltr">{sentTo}</span> مسجّلًا لدينا، فسيصلك خلال دقائق رابط لاختيار كلمة مرور جديدة. لا تنسَ مجلد الرسائل غير المرغوب فيها.
          </p>
          <div className="auth-confirm__actions">
            <button type="button" className="btn btn--secondary" disabled={busy} onClick={resend}>
              أعد إرسال الرابط
            </button>
            <Link className="btn btn--ghost" to="/login" state={location.state}>
              العودة لتسجيل الدخول
            </Link>
          </div>
          {resendNote && <p className="auth-confirm__note">{resendNote}</p>}
        </div>
      ) : (
        <>
          <h1 className="auth-panel__title" id="forgot-title">
            نسيت كلمة المرور؟
          </h1>
          <p className="auth-panel__subtitle">اكتب بريدك، ونرسل لك رابطًا لاختيار كلمة مرور جديدة.</p>

          <form ref={formRef} className="form auth-form" noValidate onSubmit={handleSubmit}>
            <div className="field">
              <label className="field__label" htmlFor="forgot-email">
                البريد الإلكتروني
              </label>
              <input
                className="input"
                id="forgot-email"
                type="email"
                dir="ltr"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                aria-invalid={Boolean(error)}
                aria-describedby="forgot-email-error"
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
              />
              <p className="field__error" id="forgot-email-error" hidden={!error}>
                {error}
              </p>
            </div>

            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy} aria-busy={busy}>
              أرسل الرابط
            </button>
          </form>

          <p className="auth-panel__switch">
            تذكرتها؟{' '}
            <Link to="/login" state={location.state}>
              سجّل الدخول
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}

/** Supabase sends expired or used links back with the error in the URL hash. */
function readLinkError(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get('error_code') ?? params.get('error');
}

export function ResetPasswordPage() {
  useDocumentTitle('كلمة مرور جديدة');
  const navigate = useNavigate();
  const phase = useSessionStore((state) => state.phase);
  const mode = useAppStore((state) => state.mode);
  const [linkError] = useState(readLinkError);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const formRef = useAutofocus();

  if (phase === 'starting' || phase === 'loading') {
    return (
      <div className="session-screen" role="status">
        <p>جارٍ التحقق من الرابط…</p>
      </div>
    );
  }

  // Only an account signed in through the link can choose a new password here.
  if (linkError || mode !== 'account') {
    return (
      <AuthShell labelledBy="reset-title">
        <div className="auth-confirm" role="alert">
          <h1 className="auth-panel__title" id="reset-title">
            الرابط غير صالح
          </h1>
          <p className="auth-panel__subtitle">
            {linkError === 'otp_expired'
              ? 'انتهت صلاحية رابط تغيير كلمة المرور، أو استُخدم من قبل.'
              : 'افتح الرابط الذي وصلك في البريد، على نفس هذا المتصفح.'}{' '}
            اطلب رابطًا جديدًا وسيصلك خلال دقائق.
          </p>
          <div className="auth-confirm__actions">
            <Link className="btn btn--primary" to="/forgot-password">
              اطلب رابطًا جديدًا
            </Link>
            <Link className="btn btn--ghost" to="/login">
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (password.length < PASSWORD_MIN_LENGTH) nextErrors.password = `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`;
    else if (confirmation !== password) nextErrors.confirmation = 'الكلمتان غير متطابقتين';
    setErrors(nextErrors);
    if (nextErrors.password || nextErrors.confirmation) {
      document.getElementById(nextErrors.password ? 'reset-password' : 'reset-confirmation')?.focus();
      return;
    }

    setBusy(true);
    const outcome = await updatePassword(password);
    setBusy(false);
    if (outcome.error) {
      setErrors({ form: outcome.error });
      return;
    }
    useUiStore.getState().showToast('غيّرنا كلمة المرور، وأنت مسجّل الدخول الآن');
    navigate('/', { replace: true });
  };

  return (
    <AuthShell labelledBy="reset-title">
      <h1 className="auth-panel__title" id="reset-title">
        اختر كلمة مرور جديدة
      </h1>
      <p className="auth-panel__subtitle">ستستخدمها من الآن لتسجيل الدخول.</p>

      <form ref={formRef} className="form auth-form" noValidate onSubmit={handleSubmit}>
        {errors.form && (
          <div className="auth-form__error" role="alert">
            <p>{errors.form}</p>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="reset-password">
            كلمة المرور الجديدة
          </label>
          <PasswordInput
            id="reset-password"
            value={password}
            autoComplete="new-password"
            describedBy="reset-password-hint reset-password-error"
            invalid={Boolean(errors.password)}
            onChange={(value) => {
              setPassword(value);
              setErrors({});
            }}
          />
          <p className="field__hint" id="reset-password-hint">
            {PASSWORD_MIN_LENGTH} أحرف على الأقل.
          </p>
          <p className="field__error" id="reset-password-error" hidden={!errors.password}>
            {errors.password}
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="reset-confirmation">
            أعد كتابتها
          </label>
          <PasswordInput
            id="reset-confirmation"
            value={confirmation}
            autoComplete="new-password"
            describedBy="reset-confirmation-error"
            invalid={Boolean(errors.confirmation)}
            onChange={(value) => {
              setConfirmation(value);
              setErrors({});
            }}
          />
          <p className="field__error" id="reset-confirmation-error" hidden={!errors.confirmation}>
            {errors.confirmation}
          </p>
        </div>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy} aria-busy={busy}>
          حفظ كلمة المرور
        </button>
      </form>
    </AuthShell>
  );
}
