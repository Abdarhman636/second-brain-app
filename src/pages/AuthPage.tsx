/*
 * Sign in / create account, next to a short introduction to the app for
 * people who are new to it.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { ThemeToggle } from '../components/AppLayout';
import { AppIntro } from '../components/AppIntro';
import { Icon } from '../components/Icon';
import { PASSWORD_MIN_LENGTH, resendConfirmation, signIn, signUp, startDemo } from '../data/session';
import { isBackendConfigured } from '../data/supabase/client';
import { useDocumentTitle } from '../hooks/use-document-title';

type Mode = 'login' | 'signup';
type Field = 'name' | 'email' | 'password';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY = {
  login: {
    documentTitle: 'تسجيل الدخول',
    title: 'أهلًا بعودتك',
    subtitle: 'سجّل دخولك لتكمل مراجعة اليوم.',
    submitLabel: 'تسجيل الدخول',
    switchText: 'ليس لديك حساب؟',
    switchLabel: 'أنشئ حسابًا جديدًا',
    switchTo: '/signup',
  },
  signup: {
    documentTitle: 'إنشاء حساب',
    title: 'أنشئ حسابك',
    subtitle: 'دقيقة واحدة، ثم ابدأ بحفظ أول ما تعلمته.',
    submitLabel: 'إنشاء الحساب',
    switchText: 'لديك حساب بالفعل؟',
    switchLabel: 'سجّل الدخول',
    switchTo: '/login',
  },
} as const;

function validate(mode: Mode, values: Record<Field, string>): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (mode === 'signup' && !values.name) errors.name = 'اكتب اسمك';
  if (!values.email) errors.email = 'اكتب بريدك الإلكتروني';
  else if (!EMAIL_PATTERN.test(values.email)) errors.email = 'تأكد من صيغة البريد الإلكتروني';
  if (!values.password) errors.password = 'اكتب كلمة المرور';
  else if (mode === 'signup' && values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`;
  }
  return errors;
}

function PasswordInput(props: { id: string; value: string; autoComplete: string; describedBy: string; invalid: boolean; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input
        className="input"
        id={props.id}
        type={visible ? 'text' : 'password'}
        dir="ltr"
        autoComplete={props.autoComplete}
        value={props.value}
        aria-invalid={props.invalid}
        aria-describedby={props.describedBy}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <button
        type="button"
        className="password-field__toggle"
        aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        <Icon name="eye" size={18} />
      </button>
    </div>
  );
}

export function AuthPage({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const isSignup = mode === 'signup';
  useDocumentTitle(copy.documentTitle);

  const location = useLocation();

  const [values, setValues] = useState<Record<Field, string>>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  /** Set after sign-up (or a sign-in attempt) while the email is still unconfirmed. */
  const [pendingEmail, setPendingEmail] = useState<{ email: string; justSignedUp: boolean } | null>(null);
  const [resendNote, setResendNote] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  // On phones, opening the keyboard immediately would hide the introduction.
  useEffect(() => {
    if (window.matchMedia('(min-width: 721px)').matches) formRef.current?.querySelector('input')?.focus();
  }, [mode]);

  const update = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
  };

  // On success there's nothing more to do here: the session listener loads the
  // account, and <PublicOnly> then redirects to the requested page.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = { name: values.name.trim(), email: values.email.trim(), password: values.password };
    const nextErrors = validate(mode, trimmed);
    setErrors(nextErrors);

    const firstInvalid = (['name', 'email', 'password'] as const).find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(`auth-${firstInvalid}`)?.focus();
      return;
    }

    setBusy(true);
    setPendingEmail(null);
    const outcome = isSignup ? await signUp(trimmed.name, trimmed.email, trimmed.password) : await signIn(trimmed.email, trimmed.password);

    if (outcome.needsConfirmation) {
      setBusy(false);
      setPendingEmail({ email: trimmed.email, justSignedUp: true });
      return;
    }
    if (outcome.error) {
      setBusy(false);
      setFormError(outcome.error);
      if (!isSignup && outcome.error.includes('لم يُؤكَّد')) setPendingEmail({ email: trimmed.email, justSignedUp: false });
      document.getElementById(isSignup ? 'auth-email' : 'auth-password')?.focus();
    }
  };

  const resend = async () => {
    if (!pendingEmail) return;
    setResendNote('جارٍ الإرسال…');
    const { error } = await resendConfirmation(pendingEmail.email);
    setResendNote(error ?? 'أرسلنا رسالة تأكيد جديدة.');
  };

  const tryDemo = async () => {
    setBusy(true);
    await startDemo();
  };

  const fieldProps = (field: Field) => ({
    id: `auth-${field}`,
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': `auth-${field}-error${field === 'password' && isSignup ? ' auth-password-hint' : ''}`,
  });

  const fieldError = (field: Field) => (
    <p className="field__error" id={`auth-${field}-error`} hidden={!errors[field]}>
      {errors[field]}
    </p>
  );

  return (
    <div className="auth-page">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-layout">
        <AppIntro />

        <section className="auth-panel" aria-labelledby="auth-title">
          {pendingEmail?.justSignedUp ? (
            <div className="auth-confirm" role="status">
              <span className="auth-confirm__icon">
                <Icon name="check" size={22} />
              </span>
              <h1 className="auth-panel__title" id="auth-title">
                تحقق من بريدك
              </h1>
              <p className="auth-panel__subtitle">
                أرسلنا رابط تأكيد إلى <span dir="ltr">{pendingEmail.email}</span>. افتحه لتفعيل حسابك، وسندخلك مباشرة.
              </p>
              <div className="auth-confirm__actions">
                <button type="button" className="btn btn--secondary" onClick={resend}>
                  أعد إرسال الرسالة
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setPendingEmail(null)}>
                  تعديل البريد
                </button>
              </div>
              {resendNote && <p className="auth-confirm__note">{resendNote}</p>}
            </div>
          ) : (
            <>
              <h1 className="auth-panel__title" id="auth-title">
                {copy.title}
              </h1>
              <p className="auth-panel__subtitle">{copy.subtitle}</p>

              <form ref={formRef} className="form auth-form" noValidate onSubmit={handleSubmit}>
                {formError && (
                  <div className="auth-form__error" role="alert">
                    <p>{formError}</p>
                    {pendingEmail && (
                      <button type="button" className="auth-form__error-action" onClick={resend}>
                        أعد إرسال رسالة التأكيد
                      </button>
                    )}
                    {resendNote && <p className="auth-form__error-note">{resendNote}</p>}
                  </div>
                )}

                {isSignup && (
                  <div className="field">
                    <label className="field__label" htmlFor="auth-name">
                      الاسم
                    </label>
                    <input
                      className="input"
                      type="text"
                      autoComplete="name"
                      placeholder="كيف نناديك؟"
                      value={values.name}
                      onChange={(event) => update('name', event.target.value)}
                      {...fieldProps('name')}
                    />
                    {fieldError('name')}
                  </div>
                )}

                <div className="field">
                  <label className="field__label" htmlFor="auth-email">
                    البريد الإلكتروني
                  </label>
                  <input
                    className="input"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={values.email}
                    onChange={(event) => update('email', event.target.value)}
                    {...fieldProps('email')}
                  />
                  {fieldError('email')}
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="auth-password">
                    كلمة المرور
                  </label>
                  <PasswordInput
                    id="auth-password"
                    value={values.password}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    describedBy={fieldProps('password')['aria-describedby']}
                    invalid={Boolean(errors.password)}
                    onChange={(value) => update('password', value)}
                  />
                  {isSignup && (
                    <p className="field__hint" id="auth-password-hint">
                      {PASSWORD_MIN_LENGTH} أحرف على الأقل.
                    </p>
                  )}
                  {fieldError('password')}
                </div>

                <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy} aria-busy={busy}>
                  {copy.submitLabel}
                </button>
              </form>

              <p className="auth-panel__switch">
                {copy.switchText} <Link to={copy.switchTo} state={location.state}>{copy.switchLabel}</Link>
              </p>
            </>
          )}

          <div className="auth-demo">
            <span className="auth-demo__divider">أو</span>
            <button type="button" className="btn btn--secondary btn--block" disabled={busy} aria-busy={busy} onClick={tryDemo}>
              جرّب التطبيق بدون حساب
            </button>
            <p className="auth-demo__note">
              {isBackendConfigured
                ? 'مشاريع وبطاقات تجريبية جاهزة، ولا يُحفظ فيها شيء.'
                : 'الحسابات غير مفعّلة في هذه النسخة؛ جرّب التطبيق ببيانات تجريبية.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
